const CACHE = 'my-keiba-lab-v51-margin-audit';

// 起動に必要な最小構成だけを事前キャッシュ。
// 追加モジュールは初回利用時にキャッシュし、更新時の一括addAll失敗を避ける。
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './integrated-v4.css',
  './lapkun-v5.css',
  './lapkun-v6.css',
  './editorial-v8.css',
  './app.js',
  './data-model-v16.js',
  './editorial-ui-v14-fix.js',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(CORE_ASSETS.map(async asset => {
        try { await cache.add(asset); } catch {}
      })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(request) {
  try {
    const url = new URL(request.url);
    return /\.(?:js|css|webmanifest)$/i.test(url.pathname);
  } catch { return false; }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (request.mode === 'navigate' ? await cache.match('./index.html') : undefined);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
    return;
  }
  if (isStaticAsset(event.request)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  event.respondWith(networkFirst(event.request));
});
