'use client'

import { Theme } from '@radix-ui/themes'
import {
  createContext,
  FC,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'

type ThemeMode = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  theme: ThemeMode
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemeMode) => void
}

const STORAGE_KEY = 'theme'
const THEME_STORAGE_EVENT = 'eve-eyes-theme-change'
const ThemeContext = createContext<ThemeContextValue | null>(null)
const getServerTheme = (): ThemeMode => 'system'
const getServerSystemTheme = (): ResolvedTheme => 'light'

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY)

  if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
    return storedTheme
  }

  return 'system'
}

function subscribeStoredTheme(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      callback()
    }
  }
  const handleCustomChange = () => callback()

  window.addEventListener('storage', handleStorage)
  window.addEventListener(THEME_STORAGE_EVENT, handleCustomChange)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(THEME_STORAGE_EVENT, handleCustomChange)
  }
}

function subscribeSystemTheme(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => callback()

  mediaQuery.addEventListener('change', listener)

  return () => {
    mediaQuery.removeEventListener('change', listener)
  }
}

function applyThemeToDocument(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement

  root.classList.toggle('dark', resolvedTheme === 'dark')
  root.style.colorScheme = resolvedTheme
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}

const ThemeProvider: FC<PropsWithChildren> = ({ children }) => {
  const theme = useSyncExternalStore(subscribeStoredTheme, getStoredTheme, getServerTheme)
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemTheme,
    getServerSystemTheme
  )
  const resolvedTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    applyThemeToDocument(resolvedTheme)
  }, [resolvedTheme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (nextTheme) => {
        window.localStorage.setItem(STORAGE_KEY, nextTheme)
        window.dispatchEvent(new Event(THEME_STORAGE_EVENT))
      },
    }),
    [resolvedTheme, theme]
  )

  return (
    <ThemeContext.Provider value={value}>
      <Theme
        appearance={resolvedTheme}
        className="w-full bg-sds-light text-sds-dark dark:bg-sds-dark dark:text-sds-light"
      >
        {children}
      </Theme>
    </ThemeContext.Provider>
  )
}

export default ThemeProvider
