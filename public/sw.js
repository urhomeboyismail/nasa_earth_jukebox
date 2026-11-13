// Serves the data sets a listener saved (src/data/offline.ts) when the network is not available. Network first, so a saved copy never hides an
// update; only files under /data/ that are in the saved cache are ever answered from it. Everything else is left to the browser.
const SAVED_CACHE = 'earth-jukebox-saved'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || !new URL(request.url).pathname.includes('/data/')) return
  event.respondWith(
    fetch(request).catch(async () => {
      const saved = await caches.open(SAVED_CACHE).then(cache => cache.match(request, { ignoreSearch: true }))
      if (saved) return saved
      throw new Error('Offline, and this file was not saved.')
    }),
  )
})
