const CACHE = 'my-keiba-lab-v41-advanced-db33';
const ASSETS = [
  './', './index.html', './styles.css', './integrated-v4.css', './lapkun-v5.css', './lapkun-v6.css', './editorial-v8.css',
  './app.js', './data-model-v16.js', './premium-v3.js', './premium-v3-fix.js', './integrated-v4.js', './lapkun-v5.js', './lapkun-v6.js', './lapkun-v7-fix.js', './editorial-v8.js', './quality-v9.js', './quality-v10.js', './hole-manual-v11.js', './odds-v12.js', './shota-v13-fix.js', './stability-v15.js', './editorial-import-v14.js', './editorial-ui-v14-fix.js',
  './race-number-repair-v28.js', './race-ui-v17.js', './horse-tab-db-lab-v40.js', './venue-going-v27.js', './db-rank-ui-v31.js', './rank-cell-sanitize-v32.js', './nakayama11-lap-repair-v33.js', './stability-coordinator-v34.js', './avg33-sync-v35.js', './db-result-bridge-v38.js',
  './manifest.webmanifest'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));return;}event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request)));});