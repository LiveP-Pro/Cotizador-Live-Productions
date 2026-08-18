const CACHE_NAME = "luxury-travel-v52";
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const scopedPath = (pathname = "/") =>
  `${SCOPE_PATH}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
const APP_SHELL = [
  scopedPath("/"),
  scopedPath("/index.html"),
  scopedPath("/styles.css"),
  scopedPath("/app.js"),
  scopedPath("/manifest.webmanifest"),
  scopedPath("/assets/mark.svg"),
  scopedPath("/assets/logo-luxury-travel.png"),
  scopedPath("/assets/quote-template-hero.jpeg"),
  scopedPath("/assets/quote-template-full.png"),
  scopedPath("/assets/quote-template-permanent.png"),
  scopedPath("/assets/quote-template-master.png"),
  scopedPath("/assets/quote-template-master-2x.png"),
  scopedPath("/assets/quote-hero.png"),
  scopedPath("/assets/client-itinerary-hero.png"),
  scopedPath("/assets/driver-itinerary-hero.png"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.pathname.startsWith(scopedPath("/api/"))) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match(scopedPath("/"))),
      ),
  );
});
