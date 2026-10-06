// Locandina A5 di Pizzagram (PDF per la stampa + PNG a 300 dpi), con il QR verificato.
// Uso: node print/qr.mjs <codice> && node print/poster.mjs <codice>
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const code = process.argv[2];
if (!code) throw new Error('Manca il codice invito');
const here = new URL('./', import.meta.url).pathname;
const fonts = new URL('../../fonts/', import.meta.url).href;
const qr = readFileSync(here + 'out/pizzagram-qr.svg', 'utf8');
const icon = readFileSync(new URL('../../pizzagram/icons/icon.svg', import.meta.url), 'utf8');

const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><style>
@font-face{font-family:Fraunces;font-style:italic;font-weight:600 900;src:url(${fonts}fraunces-italic-latin.woff2) format("woff2");}
@font-face{font-family:Kalam;font-weight:700;src:url(${fonts}kalam-normal-latin.woff2) format("woff2");}
@page{size:148mm 210mm;margin:0;}
*{box-sizing:border-box;}
html,body{margin:0;}
body{width:148mm;height:210mm;overflow:hidden;font-family:-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#f3e8d6;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;}
.page{position:relative;width:148mm;height:210mm;padding:11mm 11mm 8mm;display:flex;flex-direction:column;align-items:center;text-align:center;
  background:radial-gradient(130% 75% at 50% 112%,#4a2414 0%,#2a1218 38%,#151217 72%);overflow:hidden;}
.page::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.07;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
.frame{position:absolute;inset:5mm;border:0.5mm solid rgba(245,201,52,.35);border-radius:4mm;pointer-events:none;}
.eyebrow{font-size:2.6mm;letter-spacing:.32em;text-transform:uppercase;color:#cabfa8;font-weight:700;margin:0;}
.icon{width:13mm;height:13mm;border-radius:3.2mm;overflow:hidden;margin:4mm 0 2mm;box-shadow:0 1.5mm 4mm rgba(0,0,0,.5);}
.icon svg{width:100%;height:100%;display:block;}
.logo{font-family:Fraunces;font-style:italic;font-weight:900;font-size:17mm;line-height:.95;letter-spacing:-.02em;color:#f5c934;
  text-shadow:0 .7mm 0 #7a3f18,0 2.5mm 6mm rgba(0,0,0,.55);margin:0;}
.note{display:inline-block;font-family:Kalam;font-weight:700;font-size:4.3mm;color:#0c2a4a;background:#f3e8d6;
  padding:1.6mm 4.5mm;border-radius:.6mm;transform:rotate(-1.5deg);box-shadow:0 1mm 3mm rgba(0,0,0,.45);margin:4mm 0 0;}
.lead{font-size:3.5mm;line-height:1.4;color:#cabfa8;margin:4.5mm 0 0;max-width:110mm;}
.qr-card{margin:5mm 0 0;background:#fff;border-radius:4mm;padding:2.5mm;box-shadow:0 2mm 8mm rgba(0,0,0,.55);
  outline:.6mm dashed #f5c934;outline-offset:1.8mm;}
.qr-card svg{display:block;width:52mm;height:52mm;}
.ticket{display:inline-flex;align-items:center;gap:2.5mm;margin-top:6mm;padding:1.8mm 4.5mm;border:.4mm dashed #f5c934;border-radius:1mm;
  background:rgba(245,201,52,.06);font-size:3.2mm;color:#cabfa8;}
.ticket b{font-family:Fraunces;font-style:italic;font-weight:800;font-size:4.2mm;letter-spacing:.04em;color:#f5c934;}
.dot{width:1.5mm;height:1.5mm;border-radius:50%;background:#c99a1e;}
.steps{list-style:none;padding:0;margin:6mm 0 0;display:grid;gap:2.6mm;text-align:left;width:112mm;}
.steps li{display:flex;align-items:center;gap:3.5mm;font-size:3.4mm;line-height:1.3;}
.steps .n{flex:none;width:7mm;height:7mm;border-radius:50%;display:grid;place-items:center;background:#d24a30;color:#fff;
  font-family:Fraunces;font-style:italic;font-weight:900;font-size:4mm;box-shadow:0 0 0 .5mm #151217,0 0 0 .9mm #c99a1e;}
.steps b{color:#f3e8d6;}
.steps span{color:#cabfa8;}
.tip{margin:5mm 0 3mm;font-size:3mm;color:#cabfa8;}
.tip b{color:#f5c934;font-weight:700;}
.foot{margin-top:auto;padding-top:3mm;border-top:.3mm solid rgba(245,201,52,.18);width:100mm;font-size:2.35mm;line-height:1.45;color:#a99f8f;}
.foot .url{font-family:Fraunces;font-style:italic;font-weight:700;font-size:3mm;color:#f5c934;letter-spacing:.02em;}
</style></head><body><div class="page"><div class="frame"></div>
  <p class="eyebrow">PizzaParty · 10° Anniversario · 10.10.2026</p>
  <div class="icon">${icon}</div>
  <h1 class="logo">Pizzagram</h1>
  <p class="note">Il social network ufficiale del PizzaParty</p>
  <p class="lead">Scatta, carica e rivivi la serata: tutte le foto della festa in un unico feed, visibile solo a noi.</p>
  <div class="qr-card">${qr}</div>
  <div><span class="ticket"><span class="dot"></span>Codice invito <b>${code}</b><span class="dot"></span></span></div>
  <ol class="steps">
    <li><span class="n">1</span><span><b>Inquadra il QR</b> con la fotocamera del telefono</span></li>
    <li><span class="n">2</span><span><b>Scegli un nickname</b>: niente account, niente password</span></li>
    <li><span class="n">3</span><span><b>Tocca +</b> per scattare o scegliere le foto, poi metti 🍕 e commenta</span></li>
  </ol>
  <p class="tip">Consiglio: <b>aggiungilo alla schermata Home</b> e ritrovi Pizzagram come un'app.</p>
  <p class="foot"><span class="url">www.pizza-party.net/pizzagram</span><br>
    Caricamenti aperti fino al 12 ottobre · foto e commenti cancellati dopo 30 giorni</p>
</div></body></html>`;

writeFileSync(here + 'out/poster.html', html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 559, height: 794 }, deviceScaleFactor: 1748 / 559 });
await page.goto('file://' + here + 'out/poster.html');
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: here + 'out/pizzagram-locandina-A5.pdf', width: '148mm', height: '210mm', printBackground: true });
await page.screenshot({ path: here + 'out/pizzagram-locandina-A5.png' });
await browser.close();
console.log('Locandina pronta: out/pizzagram-locandina-A5.pdf e .png');
