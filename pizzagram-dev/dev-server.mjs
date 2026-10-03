// Server locale per provare Pizzagram con gli emulatori Firebase (npm run dev).
// Serve la cartella del sito e aggiunge alla CSP gli indirizzi degli emulatori.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8'
};
const EMU_CONNECT = 'http://127.0.0.1:9099 http://127.0.0.1:8080 http://127.0.0.1:9199';
export const DEV_CODE = 'pizza-dev';

// Crea un documento negli emulatori scavalcando le regole ("Bearer owner").
export async function seedDoc(path, fields = {}) {
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/demo-pizzagram/databases/(default)/documents/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`seed ${path}: ${res.status} ${await res.text()}`);
}

export function startServer(port = 5173) {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(ROOT, path));
      if (!file.startsWith(ROOT) || file.includes('node_modules')) throw new Error('forbidden');
      let body = await readFile(file);
      if (file.endsWith(join('pizzagram', 'index.html'))) {
        body = body.toString()
          .replace("connect-src 'self'", `connect-src 'self' ${EMU_CONNECT}`)
          .replace("img-src 'self' data: blob:", "img-src 'self' data: blob: http://127.0.0.1:9199");
      }
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await seedDoc(`invites/${DEV_CODE}`);
  await startServer();
  console.log(`\nPizzagram locale: http://127.0.0.1:5173/pizzagram/#c=${DEV_CODE}`);
  console.log('Per diventare admin: copia l\'"ID dispositivo" dal profilo e lancia');
  console.log('  node -e "import(\'./dev-server.mjs\').then(m=>m.seedDoc(\'admins/<ID>\'))"');
  console.log('Ctrl+C per uscire.\n');
  await new Promise(() => {});
}
