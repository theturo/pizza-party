// Service worker di Pizzagram: tiene in cache i file dell'app per aprirla subito
// anche con rete scarsa. Rete prima, cache come riserva: un aggiornamento pubblicato
// arriva al primo avvio online. Foto e dati Firebase non passano di qui.
const CACHE = 'pizzagram-v11';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'config.js',
  'lib/image.js', 'lib/zip.js', 'lib/intro.js', 'lib/avatars.js', 'vendor/firebase.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  '../fonts/kalam-normal-latin.woff2', '../fonts/fraunces-italic-latin.woff2'
];

// GitHub Pages fa tenere i file al browser per 10 minuti (Cache-Control: max-age=600):
// senza 'no-cache' un aggiornamento appena pubblicato poteva installare i file vecchi.
// Con 'no-cache' il browser chiede sempre al server, che risponde 304 se non è cambiato nulla.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'no-cache' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
