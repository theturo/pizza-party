// Archivio ZIP minimale (metodo "store", senza compressione: i JPEG sono già compressi).
// Restituisce un Blob costruito a pezzi, senza copiare i dati in un unico buffer.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

export class ZipWriter {
  constructor() {
    this.parts = [];
    this.central = [];
    this.offset = 0;
  }

  // name: nome file (UTF-8), bytes: Uint8Array, date: Date
  add(name, bytes, date = new Date()) {
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(bytes);
    const { time, date: dosDate } = dosDateTime(date);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);        // versione minima
    local.setUint16(6, 0x0800, true);    // nomi in UTF-8
    local.setUint16(8, 0, true);         // store
    local.setUint16(10, time, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, bytes.length, true);
    local.setUint32(22, bytes.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, time, true);
    cen.setUint16(14, dosDate, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, bytes.length, true);
    cen.setUint32(24, bytes.length, true);
    cen.setUint16(28, nameBytes.length, true);
    cen.setUint32(42, this.offset, true);

    this.parts.push(local, nameBytes, bytes);
    this.central.push(cen, nameBytes);
    this.offset += 30 + nameBytes.length + bytes.length;
  }

  finish() {
    const count = this.central.length / 2;
    const size = this.central.reduce((s, p) => s + p.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, count, true);
    end.setUint16(10, count, true);
    end.setUint32(12, size, true);
    end.setUint32(16, this.offset, true);
    return new Blob([...this.parts, ...this.central, end], { type: 'application/zip' });
  }
}
