// VIGIA — service-worker.js simples (cache estático demo)
const CACHE = "vigia-cache-v1";
const FILES = [
  "./index.html",
  "./vigia_admin.html",
  "./app.js",
  "./admin.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));
});
self.addEventListener("fetch", e=>{
  e.respondWith(
    caches.match(e.request).then(r=> r || fetch(e.request))
  );
});
