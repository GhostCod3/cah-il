const STATIC_CACHE = "cah-il-static-v34.13.7";
const RUNTIME_CACHE = "cah-il-runtime-v34.13.7";
const FONT_CACHE = "cah-il-fonts-v34.13.7";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./cards-against-humanity-icon-32.png",
  "./cards-against-humanity-icon-180.png",
  "./cards-against-humanity-icon-192.png",
  "./cards-against-humanity-icon-512.png",
  "./cards-against-humanity-icon-maskable-512.png",
  "./cards-against-humanity-share.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  const activeCaches = new Set([
    STATIC_CACHE,
    RUNTIME_CACHE,
    FONT_CACHE
  ]);

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("cah-il-") &&
                !activeCaches.has(key)
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match("./index.html")) ||
      (await caches.match("./"))
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response && response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }

  return response;
}

async function staleWhileRevalidateFont(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);

  const networkResponse = fetch(request)
    .then((response) => {
      if (
        response &&
        (response.ok || response.type === "opaque")
      ) {
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  return cached || networkResponse;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(staleWhileRevalidateFont(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});
