'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { IconDeviceMobile, IconShare2 } from '@tabler/icons-react'

import { Section } from '@/components/setup/section'
import { Button } from '@/components/ui/button'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Whether the app is already running from the home screen. */
function useStandalone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia('(display-mode: standalone)')
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(display-mode: standalone)').matches,
    () => false,
  )
}

/** iOS has no install prompt — Safari makes you go through the share sheet. */
function useIsIos(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () =>
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !/crios|fxios/i.test(navigator.userAgent),
    () => false,
  )
}

export function InstallSection() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [justInstalled, setJustInstalled] = useState(false)
  const standalone = useStandalone()
  const ios = useIsIos()
  const installed = standalone || justInstalled

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Chrome would otherwise show its own banner on its own schedule.
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setJustInstalled(true)
      setPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  return (
    <Section
      title="Add to your home screen"
      caption="Opens like an app, and works with no signal — your data is on the device anyway."
    >
      {prompt ? (
        <Button
          onClick={async () => {
            await prompt.prompt()
            await prompt.userChoice
            setPrompt(null)
          }}
        >
          <IconDeviceMobile size={16} stroke={2.2} />
          Install
        </Button>
      ) : ios ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <IconShare2 size={16} stroke={2.2} className="mt-0.5 shrink-0" />
          <span>
            Tap <span className="text-foreground">Share</span>, then{' '}
            <span className="text-foreground">Add to Home Screen</span>.
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Use your browser&rsquo;s menu and choose{' '}
          <span className="text-foreground">Install</span> or{' '}
          <span className="text-foreground">Add to Home Screen</span>.
        </p>
      )}
    </Section>
  )
}
