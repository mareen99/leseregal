// LeseRegal – Service Worker: macht die App offline nutzbar.
const APP_CACHE = "leseregal-app-v1";
const COVER_CACHE = "leseregal-covers";
const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== APP_CACHE && k !== COVER_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Cover-Bilder: einmal laden, danach aus dem Speicher
  if (url.hostname === "covers.openlibrary.org") {
    event.respondWith(
      caches.open(COVER_CACHE).then(async cache => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const response = await fetch(request);
          if (response.ok || response.type === "opaque") cache.put(request, response.clone());
          return response;
        } catch {
          return Response.error();
        }
      })
    );
    return;
  }

  // Eigene Dateien: erst Netz (für Updates), sonst Speicher (offline)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(APP_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match("./index.html")))
    );
  }
});
