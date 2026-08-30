import type { MetadataRoute } from 'next'

/**
 * Everything lives in IndexedDB on the device, so installing this is not a
 * convenience wrapper around a server — offline is the normal case.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Budget — plan and track',
    short_name: 'Budget',
    description:
      'Plan the months ahead, log what you spend, and see when you can actually afford things.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0c0c0c',
    theme_color: '#0c0c0c',
    categories: ['finance', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      // The glyph sits inside the safe zone, so one artwork serves both.
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
