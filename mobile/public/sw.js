/* global self, caches, fetch, URL */

const CACHE_NAME = "verbo-assets-v1";
const CORE_ASSETS = ["/manifest.webmanifest", "/favicon.svg", "/icons/verbo-192.png", "/icons/verbo-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isCacheableAsset = request.method === "GET"
    && url.origin === self.location.origin
    && !url.pathname.startsWith("/api/")
    && request.mode !== "navigate"
    && (url.pathname.startsWith("/bible/") || /\.(?:css|js|mjs|png|svg|woff2?|webmanifest)$/i.test(url.pathname));

  if (!isCacheableAsset) return;

  event.respondWith(caches.match(request).then((cached) => {
    const fresh = fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    });
    return cached || fresh;
  }));
});
