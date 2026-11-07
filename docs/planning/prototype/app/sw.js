// Service worker: makes the whole app work offline after the first visit.
// Cache-first. The list of files comes from precache.json (built by tools/build_precache.mjs),
// and its version changes whenever any shipped file changes, so users get updates.
const CACHE_PREFIX = "eol-";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch("precache.json", { cache: "no-store" });
      const { version, urls } = await res.json();
      const cache = await caches.open(CACHE_PREFIX + version);
      await cache.addAll(urls); // all or nothing: a half-cached app is worse than none
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch("precache.json", { cache: "no-store" }).catch(() => null);
      const keep = res ? CACHE_PREFIX + (await res.json()).version : null;
      for (const key of await caches.keys()) {
        if (key.startsWith(CACHE_PREFIX) && key !== keep) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch (e) {
        // Offline and not cached: for page loads, fall back to the app page.
        if (req.mode === "navigate") return (await caches.match("./")) || (await caches.match("index.html"));
        throw e;
      }
    })(),
  );
});
