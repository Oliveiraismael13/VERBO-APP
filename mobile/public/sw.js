/* global self, caches, fetch, URL */

const CACHE_NAME = "verbo-assets-v4";
const CORE_ASSETS = ["/", "/manifest.webmanifest", "/favicon.svg", "/icons/verbo-180.png", "/icons/verbo-192.png", "/icons/verbo-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names.filter((name) => name.startsWith("verbo-assets-") && name !== CACHE_NAME).map((name) => caches.delete(name))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isNavigation = request.method === "GET" && request.mode === "navigate" && url.origin === self.location.origin;
  if (isNavigation) {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match("/"))));
    return;
  }
  const isCacheableAsset = request.method === "GET"
    && url.origin === self.location.origin
    && !url.pathname.startsWith("/api/")
    && (url.pathname.startsWith("/bible/") || url.pathname.startsWith("/ocr/") || /\.(?:css|js|mjs|png|svg|woff2?|webmanifest)$/i.test(url.pathname));

  if (!isCacheableAsset) return;

  event.respondWith(caches.match(request).then((cached) => {
    const fresh = fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    });
    if (cached) return cached;
    return fresh.catch(() => Promise.reject(new Error("Recurso indisponível offline")));
  }));
});
