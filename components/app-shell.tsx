'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, LineChart, Settings2 } from 'lucide-react'

import { useBudget } from '@/lib/state/store'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/', label: 'Month', icon: CalendarDays },
  { href: '/future', label: 'Future', icon: LineChart },
  { href: '/setup', label: 'Setup', icon: Settings2 },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const hydrate = useBudget((s) => s.hydrate)
  const hydrated = useBudget((s) => s.hydrated)
  const doc = useBudget((s) => s.doc)

  const onboarding = pathname === '/onboarding'

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (hydrated && !doc && !onboarding) router.replace('/onboarding')
  }, [hydrated, doc, onboarding, router])

  if (onboarding) return <>{children}</>

  if (!hydrated || !doc) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <span className="sr-only">Loading your budget</span>
      </div>
    )
  }

  return (
    <div className="md:flex md:min-h-dvh">
      <SidebarNav pathname={pathname} />
      <main className="min-h-dvh flex-1 md:min-h-0">{children}</main>
      <TabBar pathname={pathname} />
    </div>
  )
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

/** Desktop: a quiet rail. The content is the point, not the chrome. */
function SidebarNav({ pathname }: { pathname: string }) {
  return (
    <nav className="hidden w-56 shrink-0 border-r bg-card/40 p-4 md:block">
      <div className="mb-8 px-2 pt-2">
        <p className="text-sm font-semibold tracking-tight">Budget</p>
        <p className="text-xs text-muted-foreground">Plan, not bookkeeping</p>
      </div>
      <ul className="space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon className="size-4" strokeWidth={2} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Phone: thumb-reachable tabs, below the sticky impact bar. */
function TabBar({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-safe backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-md">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
