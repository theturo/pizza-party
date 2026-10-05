// Genera le icone PNG della PWA da pizzagram/icons/icon.svg (npm run icons).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync('../pizzagram/icons/icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `../pizzagram/icons/${name}`, omitBackground: false });
}
await browser.close();
