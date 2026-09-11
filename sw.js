const CACHE = 'my-keiba-lab-v10-2';
const ASSETS = [
  './', './index.html', './styles.css', './integrated-v4.css', './lapkun-v5.css', './lapkun-v6.css', './editorial-v8.css',
  './app.js', './premium-v3.js', './premium-v3-fix.js', './integrated-v4.js', './lapkun-v5.js', './lapkun-v6.js', './lapkun-v7-fix.js', './editorial-v8.js', './quality-v9.js', './quality-v10.js',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
