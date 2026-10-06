// Preparazione foto prima del caricamento:
// - legge la data di scatto dall'EXIF (prima di ricomprimere, perché il canvas la perde);
// - ridimensiona e ricomprime in JPEG: pesa ~10 volte meno e il canvas elimina
//   tutti i metadati, compresa la posizione GPS.

// Data di scatto (DateTimeOriginal, altrimenti DateTime) da un JPEG; null se assente.
export function parseExifDate(view) {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) return null;
  let off = 2;
  while (off + 4 <= view.byteLength) {
    const marker = view.getUint16(off);
    if ((marker & 0xFF00) !== 0xFF00) return null;
    const size = view.getUint16(off + 2);
    // APP1 con intestazione "Exif\0\0"
    if (marker === 0xFFE1 && off + 10 <= view.byteLength && view.getUint32(off + 4) === 0x45786966) {
      return parseTiff(view, off + 10);
    }
    if (marker === 0xFFDA) return null; // inizio dati immagine: niente EXIF
    off += 2 + size;
  }
  return null;
}

function parseTiff(view, tiff) {
  const little = view.getUint16(tiff) === 0x4949;
  const u16 = o => view.getUint16(o, little);
  const u32 = o => view.getUint32(o, little);
  if (u16(tiff + 2) !== 42) return null;

  const readIfd = (ifdOff) => {
    const tags = new Map();
    const start = tiff + ifdOff;
    if (start + 2 > view.byteLength) return tags;
    const count = u16(start);
    for (let i = 0; i < count; i++) {
      const e = start + 2 + i * 12;
      if (e + 12 > view.byteLength) break;
      tags.set(u16(e), { type: u16(e + 2), count: u32(e + 4), value: e + 8 });
    }
    return tags;
  };
  const ascii = (entry) => {
    if (!entry || entry.type !== 2) return null;
    const at = entry.count > 4 ? tiff + u32(entry.value) : entry.value;
    let s = '';
    for (let i = 0; i < entry.count - 1 && at + i < view.byteLength; i++) s += String.fromCharCode(view.getUint8(at + i));
    return s;
  };

  const ifd0 = readIfd(u32(tiff + 4));
  let str = null;
  const exifPtr = ifd0.get(0x8769);
  if (exifPtr) str = ascii(readIfd(u32(exifPtr.value)).get(0x9003));
  if (!str) str = ascii(ifd0.get(0x0132));
  return exifStringToDate(str);
}

// "2026:10:10 21:34:05" → Date nell'ora locale del telefono.
export function exifStringToDate(str) {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(str || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  const year = d.getFullYear();
  return isNaN(d) || year < 2000 || year > 2100 ? null : d;
}

// Errore con un codice leggibile dall'app ('read', 'empty', 'decode', 'encode').
function fail(code, file) {
  const err = new Error(code);
  err.fileInfo = file ? `${file.type || 'tipo sconosciuto'}, ${(file.size / 1048576).toFixed(1)} MB` : '';
  return err;
}

// Legge tutto il file in memoria. Sui telefoni il file scelto può essere un riferimento
// "pigro" (es. foto solo su Google Foto): leggerlo subito fa emergere l'errore qui,
// con un messaggio chiaro, invece che durante la decodifica.
async function readAll(file) {
  if (!file.size) throw fail('empty', file);
  let buf;
  try {
    buf = await file.arrayBuffer();
  } catch {
    throw fail('read', file);
  }
  if (!buf.byteLength) throw fail('empty', file);
  return { buf, blob: new Blob([buf], { type: file.type || 'image/jpeg' }) };
}

function decodeWithImg(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve({
      source: img, w: img.naturalWidth, h: img.naturalHeight,
      release: () => URL.revokeObjectURL(url)
    });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
    img.src = url;
  });
}

async function decodeWithBitmap(blob) {
  if (typeof createImageBitmap !== 'function') throw new Error('bitmap');
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  return { source: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() };
}

// Prima <img> (su iPhone è l'unico che rispetta sempre la rotazione EXIF),
// poi createImageBitmap, che su Android usa un percorso di decodifica diverso.
async function decode(blob, file) {
  try {
    return await decodeWithImg(blob);
  } catch { /* si prova l'altro decoder */ }
  try {
    return await decodeWithBitmap(blob);
  } catch {
    throw fail('decode', file);
  }
}

function toJpeg(image, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(image.w, image.h));
  const w = Math.max(1, Math.round(image.w * scale));
  const h = Math.max(1, Math.round(image.h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  // L'orientamento EXIF viene già applicato in decodifica.
  ctx.drawImage(image.source, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => {
      canvas.width = canvas.height = 0; // libera memoria subito (iOS è severo)
      b ? resolve({ blob: b, w, h }) : reject(fail('encode'));
    }, 'image/jpeg', quality);
  });
}

// Restituisce { feed, thumb, hd, w, h, takenAt }; errore "decode" se il formato non è leggibile
// (es. HEIC su Android). L'HD ha qualità alta: a schermo e in stampa fino a ~20×15 cm
// non si distingue dall'originale, ma pesa circa un terzo.
export async function prepareImage(file, { feedSize, thumbSize, hdSize }) {
  const { buf, blob } = await readAll(file);
  const takenAt = parseExifDateSafe(buf);
  const image = await decode(blob, file);
  try {
    const feed = await toJpeg(image, feedSize, 0.82);
    const thumb = await toJpeg(image, thumbSize, 0.72);
    const hd = await toJpeg(image, hdSize, 0.9);
    return { feed: feed.blob, thumb: thumb.blob, hd: hd.blob, w: feed.w, h: feed.h, takenAt };
  } finally {
    image.release();
  }
}

function parseExifDateSafe(buf) {
  try {
    return parseExifDate(new DataView(buf, 0, Math.min(buf.byteLength, 256 * 1024)));
  } catch {
    return null;
  }
}
