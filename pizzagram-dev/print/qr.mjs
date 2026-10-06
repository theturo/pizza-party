// QR per l'ingresso: PNG ad alta risoluzione e SVG vettoriale, poi verifica di lettura.
// Uso: node print/qr.mjs <codice-invito>
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { readFileSync, mkdirSync } from 'node:fs';

const code = process.argv[2];
if (!code) throw new Error('Manca il codice invito');
const url = `https://www.pizza-party.net/pizzagram/#c=${code}`;
const out = new URL('./out/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

// Correzione d'errore Q (25%): regge stampe non perfette e un po' di riflessi.
const opts = { errorCorrectionLevel: 'Q', margin: 4, color: { dark: '#151217', light: '#ffffff' } };
await QRCode.toFile(out + 'pizzagram-qr.png', url, { ...opts, width: 2400 });
await QRCode.toFile(out + 'pizzagram-qr.svg', url, { ...opts, type: 'svg' });

const png = PNG.sync.read(readFileSync(out + 'pizzagram-qr.png'));
const read = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
if (read?.data !== url) throw new Error('Il QR non si legge correttamente: ' + read?.data);
console.log('QR verificato:', read.data, `(${png.width}×${png.height} px)`);
