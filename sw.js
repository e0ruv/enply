/* ENPLY service worker
   Every request is network-first: whenever the network answers, that answer is
   used and cached, so a UI redeploy or an admin save on the site shows up right
   away instead of being hidden behind an older cache. The cache only answers
   when the network is unavailable (offline / flaky connection). */

const CACHE = 'enply-shell-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;
  event.respondWith(networkFirst(req, url));
});

async function networkFirst(req, url) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res && res.status === 200) {
      const type = res.headers.get('content-type') || '';
      const len = Number(res.headers.get('content-length') || 0);
      const skip = type.startsWith('audio/') || type.startsWith('video/') || len > 4 * 1024 * 1024;
      if (!skip) {
        try { await cache.put(req, res.clone()); } catch (e) { /* quota or opaque */ }
      }
    }
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html') || await cache.match('./');
      if (shell) return shell;
    }
    throw err;
  }
}
