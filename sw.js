/* Finance Health — service worker.
   Network-first for the page itself (so updates show immediately when online),
   cache-first for other assets, with an offline fallback throughout. */
const CACHE = "finance-health-v18";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cachePut(req, res) {
  if (res && res.ok && new URL(req.url).origin === location.origin) {
    const copy = res.clone();
    caches.open(CACHE).then((cache) => cache.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const isPage = req.mode === "navigate" || req.destination === "document";

  if (isPage) {
    // Network-first: always try to load the freshest app when online, so
    // updates appear on the next open; fall back to the cached copy offline.
    event.respondWith(
      fetch(req)
        .then((res) => cachePut(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first for everything else (icons, manifest), refreshing in the background.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const fetched = fetch(req).then((res) => cachePut(req, res)).catch(() => cached);
      return cached || fetched;
    })
  );
});
