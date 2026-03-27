'use client'

import * as Toggle from '@radix-ui/react-toggle'
import { Badge } from '@radix-ui/themes'
import { MoonIcon, SunIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTheme } from '../providers/ThemeProvider'

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <Toggle.Root aria-label="Toggle theme" onPressedChange={toggleTheme}>
      <Badge
        className="rounded-full border border-slate-200/80 bg-white/80 p-2 text-slate-700 shadow transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200"
        highContrast={true}
      >
        {theme === 'dark' ? (
          <SunIcon className="h-5 w-5" />
        ) : (
          <MoonIcon className="h-5 w-5" />
        )}
      </Badge>
    </Toggle.Root>
  )
}

export default ThemeSwitcher
