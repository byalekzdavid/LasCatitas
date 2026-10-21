const CACHE_NAME = "las-catitas-v1";
const BASE = "/LasCatitas/";
const FILES = [BASE, BASE+"index.html", BASE+"audios.html", BASE+"style.css", BASE+"manifest.json", BASE+"icons/icon-192.png", BASE+"icons/icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES).catch(() => {})));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const r=e.request, u=new URL(r.url);
  if (u.origin !== self.location.origin || r.method !== "GET") return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then(res => {
      const copy=res.clone(); caches.open(CACHE_NAME).then(c=>c.put(r,copy)); return res;
    }).catch(async()=> (await caches.match(r)) || caches.match(BASE+"index.html")));
  } else {
    e.respondWith(caches.match(r).then(hit=>hit || fetch(r).then(res=>{
      if(res.ok){const copy=res.clone(); caches.open(CACHE_NAME).then(c=>c.put(r,copy));} return res;
    })));
  }
});