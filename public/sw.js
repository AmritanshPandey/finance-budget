/**
 * A small hand-rolled service worker.
 *
 * The app is static and keeps all its data in IndexedDB, so there is no API to
 * synchronise and no offline queue to manage — this only needs to make the shell
 * available without a network.
 *
 * Build assets are content-hashed and therefore immutable: cache-first. Anything
 * else is network-first so a deploy is picked up immediately, with the cache as
 * a fallback when there is no connection.
 */

const VERSION = 'v1'
const ASSETS = `budget-assets-${VERSION}`
const PAGES = `budget-pages-${VERSION}`

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => !key.endsWith(VERSION)).map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

function isCacheable(response) {
  return response && response.status === 200 && response.type === 'basic'
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (isCacheable(response)) {
    const cache = await caches.open(ASSETS)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (isCacheable(response)) {
      const cache = await caches.open(PAGES)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) return cached
    // A deep link opened offline still deserves the app, not a browser error.
    if (request.mode === 'navigate') {
      const shell = await caches.match('/')
      if (shell) return shell
    }
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(networkFirst(request))
})
