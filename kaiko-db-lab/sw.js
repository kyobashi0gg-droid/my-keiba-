const CACHE='kaiko-db-lab-pwa-v1';
const PREFIX='kaiko-db-lab-pwa-';
const HOME=new URL('./',self.registration.scope).href;
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.add(new Request(HOME,{cache:'reload'}));await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',e=>{let r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith(new URL(HOME).pathname)||r.mode!=='navigate')return;e.respondWith((async()=>{let c=await caches.open(CACHE);try{let res=await fetch(r,{cache:'no-store'});if(res.ok)await c.put(HOME,res.clone());return res}catch(err){return (await c.match(HOME))||Response.error()}})())});
