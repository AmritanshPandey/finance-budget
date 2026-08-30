'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker in production only — in development it would sit
 * between the browser and the dev server's hot reloads and cache the wrong thing.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // An unavailable service worker costs offline support and nothing else.
      })
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
