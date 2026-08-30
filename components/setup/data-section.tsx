'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Moon, Sun, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Section } from '@/components/setup/section'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useBudget } from '@/lib/state/store'

export function DataSection() {
  const router = useRouter()
  const exportDoc = useBudget((s) => s.exportDoc)
  const importDoc = useBudget((s) => s.importDoc)
  const reset = useBudget((s) => s.reset)
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirming, setConfirming] = useState(false)

  function download() {
    const blob = new Blob([exportDoc()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `budget-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function onFile(file: File) {
    const result = importDoc(await file.text())
    if (result.ok) toast('Budget restored')
    else toast.error(result.error)
  }

  return (
    <Section
      title="Your data"
      caption="Everything lives on this device. Export it to move or keep a copy."
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="size-4" />
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" />
          Import
        </Button>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="size-4" />
          Start over
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onFile(file)
          e.target.value = ''
        }}
      />

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete everything?</AlertDialogTitle>
            <AlertDialogDescription>
              Every month, goal and loan on this device goes. There is no undo — export
              first if you might want it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await reset()
                router.replace('/onboarding')
              }}
            >
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}

function ThemeToggle() {
  const [dark, setDark] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const next = !dark
        document.documentElement.classList.toggle('dark', next)
        try {
          localStorage.setItem('theme', next ? 'dark' : 'light')
        } catch {}
        setDark(next)
      }}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {dark ? 'Light' : 'Dark'}
    </Button>
  )
}
