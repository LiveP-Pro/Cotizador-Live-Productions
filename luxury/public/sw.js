const VERSION = "86";
const CACHE_PREFIX = "luxury-travel-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-v${VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v${VERSION}`;
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");

const scopedPath = (pathname = "/") =>
  `${SCOPE_PATH}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;

const INDEX_URL = scopedPath("/index.html");
const API_PATH = scopedPath("/api/");
const CORE_ASSETS = [
  scopedPath("/"),
  INDEX_URL,
  scopedPath(`/styles.css?v=${VERSION}`),
  scopedPath(`/app.js?v=${VERSION}`),
  scopedPath("/manifest.webmanifest"),
  scopedPath("/assets/mark.svg"),
  scopedPath("/assets/logo-luxury-travel.png"),
  scopedPath("/assets/pwa-icon-192.png"),
  scopedPath("/assets/pwa-icon-512.png"),
  scopedPath("/assets/pwa-maskable-512.png"),
  scopedPath("/assets/apple-touch-icon.png"),
];

function isWithinLuxuryScope(pathname) {
  if (!SCOPE_PATH) return true;
  return pathname === SCOPE_PATH || pathname.startsWith(`${SCOPE_PATH}/`);
}

function offlineApiResponse() {
  return new Response(
    JSON.stringify({ error: "Sin conexión. Conéctese a internet para consultar o guardar datos." }),
    {
      status: 503,
      statusText: "Offline",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response("Recurso no disponible sin conexión.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function navigationResponse(event) {
  try {
    const preload = await event.preloadResponse;
    if (preload) return preload;
    return await fetch(event.request);
  } catch {
    return (await caches.match(INDEX_URL)) || (await caches.match(scopedPath("/")));
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE && key !== RUNTIME_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || !isWithinLuxuryScope(url.pathname)) return;

  if (url.pathname.startsWith(API_PATH)) {
    event.respondWith(fetch(request).catch(offlineApiResponse));
    return;
  }

  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(event));
    return;
  }

  event.respondWith(networkFirst(request));
});
