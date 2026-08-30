import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'

import { AppShell } from '@/components/app-shell'
import { PwaRegister } from '@/components/pwa-register'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
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
  themeColor: '#0c0c0c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
        <Toaster position="top-center" />
        <PwaRegister />
      </body>
    </html>
  )
}
