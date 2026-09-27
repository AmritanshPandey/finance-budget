import type { Metadata, Viewport } from 'next'
import { Inter, Newsreader } from 'next/font/google'

import { AppShell } from '@/components/app-shell'
import { PwaRegister } from '@/components/pwa-register'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

/** Carries the figures. A book face, not a dashboard face. */
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Budget',
  description:
    'Plan the months ahead, log what you spend, and see when you can actually afford things.',
  applicationName: 'Budget',
  appleWebApp: {
    capable: true,
    title: 'Budget',
    // The app paints its own near-black, so the status bar should get out of it.
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#fbfbfa',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
        <Toaster position="top-center" />
        <PwaRegister />
      </body>
    </html>
  )
}
