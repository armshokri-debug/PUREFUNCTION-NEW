/* Pure Function service worker.
 * - Pages: network first (so a new version shows up right away), cached copy only when offline.
 * - Built files (hashed names never change): cache first.
 * - Anything on another origin (the database, video, fonts API) is never touched.
 * Bump VERSION to drop old caches. */
const VERSION = 'pf-v2';
const SHELL = VERSION + '-shell';
const ASSETS = VERSION + '-assets';
const ROOT = new URL('./', self.location).pathname;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.add(ROOT)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(ROOT, copy));
          }
          return res;
        })
        .catch(() => caches.match(ROOT).then((r) => r || Response.error()))
    );
    return;
  }

  if (url.pathname.startsWith(ROOT + 'assets/') || url.pathname.startsWith(ROOT + 'icons/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
