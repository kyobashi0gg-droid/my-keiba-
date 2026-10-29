// Keep PWA caches separate from DB Lab and other apps on the same origin.
const CACHE = 'my-keiba-lab-v68-smartrc';
const CACHE_PREFIX = 'my-keiba-lab-';
const CORE_ASSETS = [
  './', './index.html', './styles.css', './integrated-v4.css',
  './lapkun-v5.css', './lapkun-v6.css', './editorial-v8.css',
  './app.js', './data-model-v16.js', './editorial-ui-v14-fix.js',
  './manifest.webmanifest', './icons/icon-192.png',
  './icons/icon-512.png', './icons/icon-maskable-512.png'
];
const APP_PATH = new URL(self.registration.scope).pathname;
const DB_LAB_PATH = new URL('./db-lab/', self.registration.scope).pathname;
const CHARANIZE_DB_PATH = new URL('./charanize-db/', self.registration.scope).pathname;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await Promise.allSettled(CORE_ASSETS.map(asset => cache.add(asset)));
    await self.skipWaiting();
  }));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      try { await cache.put(request, response.clone()); } catch (_) {}
    }
    return response;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const home = await cache.match('./index.html');
      if (home) return home;
    }
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Keep both DB Lab sites independent of the MY KEIBA LAB PWA cache.
  // Do not intercept external PDF/CDN requests.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_PATH)
      || url.pathname.startsWith(DB_LAB_PATH)
      || url.pathname.startsWith(CHARANIZE_DB_PATH)) return;
  // Rank feed must never silently fall back to an older cached revision.
  if (url.pathname.endsWith('/smartrc-ranks-v1.json')) { event.respondWith(fetch(request)); return; }
  event.respondWith(networkFirst(request));
});

