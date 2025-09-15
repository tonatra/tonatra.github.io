// VIGIA — service-worker.js (cache v2)
const CACHE = "vigia-cache-v2";
const FILES = [
  "./index.html",
  "./vigia_admin.html",
  "./app.js",
  "./admin.js",
  "./ai_demo.html",
  "./ai_demo.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
});
self.addEventListener("fetch", e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
