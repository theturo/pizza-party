// Preparazione foto prima del caricamento:
// - legge la data di scatto dall'EXIF (prima di ricomprimere, perché il canvas la perde);
// - ridimensiona e ricomprime in JPEG: pesa ~10 volte meno e il canvas elimina
//   tutti i metadati, compresa la posizione GPS.

// Data di scatto (DateTimeOriginal, altrimenti DateTime) da un JPEG; null se assente.
export async function readExifDate(file) {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    return parseExifDate(new DataView(buf));
  } catch {
    return null;
  }
}

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

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

function toJpeg(img, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  // L'orientamento EXIF viene già applicato dal browser quando decodifica <img>.
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => {
      canvas.width = canvas.height = 0; // libera memoria subito (iOS è severo)
      b ? resolve({ blob: b, w, h }) : reject(new Error('encode'));
    }, 'image/jpeg', quality);
  });
}

// Restituisce { feed, thumb, hd, w, h, takenAt }; errore "decode" se il formato non è leggibile
// (es. HEIC su Android). L'HD ha qualità alta: a schermo e in stampa fino a ~20×15 cm
// non si distingue dall'originale, ma pesa circa un terzo.
export async function prepareImage(file, { feedSize, thumbSize, hdSize }) {
  const takenAt = await readExifDate(file);
  const { img, url } = await loadImage(file);
  try {
    const feed = await toJpeg(img, feedSize, 0.82);
    const thumb = await toJpeg(img, thumbSize, 0.72);
    const hd = await toJpeg(img, hdSize, 0.9);
    return { feed: feed.blob, thumb: thumb.blob, hd: hd.blob, w: feed.w, h: feed.h, takenAt };
  } finally {
    URL.revokeObjectURL(url);
  }
}
