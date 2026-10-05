// Test end-to-end nel browser contro gli emulatori: npm run test:e2e
// Due invitati su telefono: ingresso, caricamento, like, commenti, album, cancellazione.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startServer, seedDoc } from '../dev-server.mjs';

const CODE = 'pizza-test';
const BASE = 'http://127.0.0.1:5173/pizzagram/?intro=0';
const SHOTS = new URL('../test-results/', import.meta.url).pathname;
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT', timezoneId: 'Europe/Rome' };
let server, browser;

before(async () => {
  mkdirSync(SHOTS, { recursive: true });
  await seedDoc(`invites/${CODE}`);
  server = await startServer(5173);
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

// JPEG di prova con EXIF DateTimeOriginal = 11/10/2025 21:34:05 (una foto dell'anno scorso).
async function fixtureJpeg(page, hue = 20) {
  const dataUrl = await page.evaluate(h => {
    const c = document.createElement('canvas');
    c.width = 2400; c.height = 1800;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 2400, 1800);
    g.addColorStop(0, `hsl(${h},70%,45%)`); g.addColorStop(1, `hsl(${h + 40},80%,25%)`);
    x.fillStyle = g; x.fillRect(0, 0, 2400, 1800);
    x.fillStyle = '#f5c934'; x.beginPath(); x.arc(1200, 900, 600, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#d24a30';
    for (const [a, b] of [[1000, 700], [1400, 820], [1100, 1120], [1450, 1150]]) { x.beginPath(); x.arc(a, b, 90, 0, Math.PI * 2); x.fill(); }
    return c.toDataURL('image/jpeg', 0.9);
  }, hue);
  const jpeg = Buffer.from(dataUrl.split(',')[1], 'base64');
  const tiff = Buffer.alloc(64);
  tiff.write('MM', 0, 'ascii'); tiff.writeUInt16BE(42, 2); tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8); // IFD0: 1 voce
  tiff.writeUInt16BE(0x8769, 10); tiff.writeUInt16BE(4, 12); tiff.writeUInt32BE(1, 14); tiff.writeUInt32BE(26, 18);
  tiff.writeUInt32BE(0, 22);
  tiff.writeUInt16BE(1, 26); // Exif IFD: 1 voce
  tiff.writeUInt16BE(0x9003, 28); tiff.writeUInt16BE(2, 30); tiff.writeUInt32BE(20, 32); tiff.writeUInt32BE(44, 36);
  tiff.writeUInt32BE(0, 40);
  tiff.write('2025:10:11 21:34:05\0', 44, 'ascii');
  const app1 = Buffer.concat([Buffer.from([0xFF, 0xE1, 0, 72]), Buffer.from('Exif\0\0', 'binary'), tiff]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

async function joinAs(nick, code = CODE) {
  const ctx = await browser.newContext({ ...PHONE, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => console.error(`[${nick}] pageerror`, e.message));
  await page.goto(`${BASE}#c=${code}`);
  await page.waitForSelector('#join:not([hidden])');
  assert.equal(new URL(page.url()).hash, '', 'il codice sparisce dalla barra degli indirizzi');
  await page.fill('#join-nick', nick);
  await page.click('#join-btn');
  return page;
}

test('due invitati alla PizzaParty', { timeout: 120_000 }, async () => {
  // Codice sbagliato: niente ingresso
  const intruder = await joinAs('Intruso', 'codice-falso');
  await intruder.waitForSelector('#join-error:has-text("Codice invito non valido")');
  await intruder.context().close();

  // Marghe entra e trova il feed vuoto
  const a = await joinAs('Marghe');
  await a.waitForSelector('#feed-empty:not([hidden])');
  await a.screenshot({ path: SHOTS + '1-feed-vuoto.png' });

  // Carica due foto
  await a.setInputFiles('#file-input', [
    { name: 'festa.jpg', mimeType: 'image/jpeg', buffer: await fixtureJpeg(a, 20) },
    { name: 'forno.jpg', mimeType: 'image/jpeg', buffer: await fixtureJpeg(a, 200) }
  ]);
  await a.waitForSelector('#composer.open');
  await a.locator('.composer-item textarea').first().fill('Prima pizza della serata 🍕');
  await a.screenshot({ path: SHOTS + '2-nuovo-post.png' });
  await a.click('#composer-publish');
  await a.waitForFunction(() => document.querySelectorAll('#feed .post').length === 2, null, { timeout: 30_000 });
  await a.waitForSelector('#uploads[hidden]', { state: 'attached', timeout: 15_000 });
  const when = await a.locator('#feed .post-when').first().textContent();
  assert.equal(when, 'scattata 11 ott 2025', 'usa la data di scatto EXIF');
  await a.waitForSelector('#feed .post-caption:has-text("Prima pizza della serata")');

  // La foto caricata è ridimensionata e senza EXIF (niente GPS)
  const info = await a.evaluate(async () => {
    const img = document.querySelector('#feed .post-media img');
    const bytes = new Uint8Array(await (await fetch(img.src)).arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
    return { size: bytes.length, exif: text.includes('Exif'), w: img.naturalWidth };
  });
  assert.equal(info.exif, false);
  assert.ok(info.w <= 1600 && info.size < 1_000_000, JSON.stringify(info));

  // Like e commento
  await a.locator('#feed .like-btn').first().click();
  await a.waitForSelector('#feed .post-likes:has-text("Piace a te")');
  await a.locator('#feed .post-comments-link').first().click();
  await a.waitForSelector('#comments.open');
  await a.fill('#comment-input', 'Che fame!');
  await a.press('#comment-input', 'Enter');
  await a.waitForSelector('#comments-list .comment-body:has-text("Che fame!")');
  await a.screenshot({ path: SHOTS + '4-commenti.png' });
  await a.click('#comments .sheet-backdrop', { position: { x: 20, y: 20 } });
  await a.waitForSelector('#comments', { state: 'hidden' });
  await a.waitForSelector('#feed .post-comments-link:has-text("Visualizza 1 commento")');

  // Zio Totò entra, vede tutto in tempo reale e mette like col doppio tap
  const b = await joinAs('Zio Totò');
  await b.waitForFunction(() => document.querySelectorAll('#feed .post').length === 2);
  assert.equal(await b.locator('#feed .post-head .icon-btn').first().isHidden(), true, 'niente menu sui post altrui');
  await b.locator('#feed .post-media').first().dblclick();
  await a.waitForSelector('#feed .post-likes:has-text("Zio Totò")');
  await a.screenshot({ path: SHOTS + '3-feed.png' });

  // Ordine "dall'inizio"
  await b.click('#sort-btn');
  await b.waitForSelector('#sort-label:has-text("Dall\'inizio")');

  // Album a griglia e post singolo
  await b.click('.tabbar [data-view="grid"]');
  await b.waitForFunction(() => document.querySelectorAll('#grid .tile').length === 2);
  await b.screenshot({ path: SHOTS + '5-album.png' });
  await b.locator('#grid .tile').first().click();
  await b.waitForSelector('#post-modal.open .post');
  await b.click('#post-modal [data-close]');

  // Profilo: email per l'album e download ZIP
  await b.click('.tabbar [data-view="profile"]');
  await b.fill('#email-input', 'zio.toto@example.com');
  await b.click('#email-btn');
  await b.waitForSelector('#email-status:has-text("ti scriveremo")');
  await b.screenshot({ path: SHOTS + '6-profilo.png', fullPage: true });
  await b.click('[data-action="album"]');
  await b.click('#album-start');
  await b.waitForSelector('#album-save:not([hidden])', { timeout: 30_000 });
  const [download] = await Promise.all([b.waitForEvent('download'), b.click('#album-save')]);
  const buf = readFileSync(await download.path());
  const zip = { pk: buf[0] === 0x50 && buf[1] === 0x4B, size: buf.length, name: download.suggestedFilename() };
  assert.ok(zip.pk && zip.size > 10_000, JSON.stringify(zip));
  await b.screenshot({ path: SHOTS + '7-album-zip.png' });
  await b.click('#album .sheet-backdrop', { position: { x: 20, y: 20 } });
  await b.waitForSelector('#album', { state: 'hidden' });

  // Marghe elimina un suo post: sparisce anche da Zio Totò
  await a.locator('#feed .post-head .icon-btn').first().click();
  await a.click('#action-delete');
  await b.click('.tabbar [data-view="feed"]');
  await b.waitForFunction(() => document.querySelectorAll('#feed .post').length === 1, null, { timeout: 15_000 });

  // Marghe diventa admin (documento creato da console) ed elimina un post di Zio Totò
  await b.setInputFiles('#file-input', { name: 'toto.jpg', mimeType: 'image/jpeg', buffer: await fixtureJpeg(b, 120) });
  await b.click('#composer-publish');
  await b.waitForFunction(() => document.querySelectorAll('#feed .post').length === 2, null, { timeout: 30_000 });
  const adminUid = await a.locator('#device-id').textContent();
  await seedDoc(`admins/${adminUid}`);
  await a.reload();
  await a.click('.tabbar [data-view="profile"]');
  await a.waitForSelector('#admin-card:not([hidden])');
  await a.waitForSelector('#admin-stats:has-text("2 foto · 2 invitati entrati · 1 email")');
  await a.click('.tabbar [data-view="feed"]');
  const totoPost = a.locator('#feed .post', { hasText: 'Zio Totò' }).first();
  await totoPost.locator('.post-head .icon-btn').click();
  await a.click('#action-delete');
  await b.waitForFunction(() => document.querySelectorAll('#feed .post').length === 1, null, { timeout: 15_000 });

  await a.context().close();
  await b.context().close();
});
