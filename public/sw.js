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

const VERSION = 'v2'
const ASSETS = `budget-assets-${VERSION}`
const PAGES = `budget-pages-${VERSION}`

/** Routes worth having available with no network. */
const SHELL_ROUTES = ['/', '/budget', '/analytics', '/goals', '/setup', '/onboarding']

/**
 * Precache the shell during install.
 *
 * A service worker only starts intercepting *after* it activates, so on a first
 * visit every script and stylesheet has already been fetched past it. Without
 * this the app is only offline-capable from the second visit onwards — which is
 * exactly when someone would least expect it to fail.
 *
 * Build assets are content-hashed and so cannot be listed here; they are read
 * out of the served HTML instead.
 */
async function precache() {
  const pages = await caches.open(PAGES)
  const assets = await caches.open(ASSETS)

  const documents = await Promise.all(
    SHELL_ROUTES.map(async (route) => {
      try {
        const response = await fetch(route, { cache: 'reload' })
        if (!isCacheable(response)) return null
        await pages.put(route, response.clone())
        return response.text()
      } catch {
        return null
      }
    }),
  )

  const urls = new Set()
  for (const html of documents) {
    if (!html) continue
    for (const match of html.matchAll(/\/_next\/static\/[^"'\\\s>]+/g)) {
      urls.add(match[0])
    }
  }
  for (const icon of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png']) {
    urls.add(icon)
  }

  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' })
        if (isCacheable(response)) await assets.put(url, response.clone())
      } catch {
        // One missing asset should not fail the whole install.
      }
    }),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().finally(() => self.skipWaiting()))
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
