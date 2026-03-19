const CACHE_PREFIX = 'tapav-pwa'
const CACHE_VERSION = 'v1'
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`
const BASE_PATH = new URL(self.location.href).pathname.replace(/[^/]+$/, '')
const PRECACHE_URLS = [
  BASE_PATH,
  `${BASE_PATH}manifest.webmanifest`,
  `${BASE_PATH}icon-192.png`,
  `${BASE_PATH}icon-512.png`,
  `${BASE_PATH}icon-512-maskable.png`,
  `${BASE_PATH}apple-touch-icon.png`,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    ).then(() => self.clients.claim())
  )
})

const networkFirst = async (request) => {
  const cache = await caches.open(CACHE_NAME)

  try {
    const response = await fetch(request)
    cache.put(request, response.clone())
    return response
  } catch (error) {
    const cachedResponse = await cache.match(request)
    if (cachedResponse) return cachedResponse
    return cache.match(BASE_PATH)
  }
}

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(CACHE_NAME)
  const cachedResponse = await cache.match(request)

  const networkResponsePromise = fetch(request)
    .then((response) => {
      cache.put(request, response.clone())
      return response
    })
    .catch(() => null)

  return cachedResponse || networkResponsePromise
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const requestUrl = new URL(request.url)
  if (requestUrl.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})
