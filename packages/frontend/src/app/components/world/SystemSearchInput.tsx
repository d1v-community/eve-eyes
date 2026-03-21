'use client'

import { Loader2, Search } from 'lucide-react'
import {
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import type { SearchSystem } from '../../world/types'

type Props = {
  label: string
  placeholder: string
  selected: SearchSystem | null
  onSelect: (system: SearchSystem | null) => void
  tone?: 'light' | 'dark'
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export default function SystemSearchInput({
  label,
  placeholder,
  selected,
  onSelect,
  tone = 'light',
}: Props) {
  const [query, setQuery] = useState(selected?.name ?? '')
  const [results, setResults] = useState<SearchSystem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const deferredQuery = useDeferredValue(query)
  const listId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setQuery(selected?.name ?? '')
    setResults([])
    setIsDirty(false)
  }, [selected])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsFocused(false)
        setResults([])
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    const normalizedQuery = normalize(deferredQuery)
    const selectedMatchesQuery =
      selected != null && normalize(selected.name) === normalizedQuery

    if (!isFocused || !isDirty || normalizedQuery.length < 2 || selectedMatchesQuery) {
      setResults([])
      setIsLoading(false)
      return
    }

    const controller = new AbortController()

    const load = async () => {
      setIsLoading(true)

      try {
        const response = await fetch(
          `/api/world/systems/search?q=${encodeURIComponent(deferredQuery)}`,
          { signal: controller.signal }
        )
        const payload = (await response.json()) as {
          data?: SearchSystem[]
        }

        setResults(payload.data ?? [])
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setResults([])
        }
      } finally {
        setIsLoading(false)
      }
    }

    void load()

    return () => controller.abort()
  }, [deferredQuery, isDirty, isFocused, selected])

  const isOpen = isFocused && results.length > 0

  function handleSelect(system: SearchSystem) {
    onSelect(system)
    setQuery(system.name)
    setResults([])
    setIsDirty(false)
    setIsFocused(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setResults([])
      setIsFocused(false)
      ;(event.target as HTMLInputElement).blur()
    }
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      <label
        className={
          tone === 'dark'
            ? 'text-[10px] uppercase tracking-[0.34em] text-stone-300/70'
            : 'text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-slate-400'
        }
      >
        {label}
      </label>
      <div className="relative">
        <Search
          className={
            tone === 'dark'
              ? 'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/70'
              : 'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-slate-400'
          }
        />
        <input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={isOpen}
          value={query}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          onChange={(event) => {
            const nextValue = event.target.value

            setQuery(nextValue)
            setIsFocused(true)
            setIsDirty(true)

            if (selected?.name !== nextValue) {
              onSelect(null)
            }
          }}
          placeholder={placeholder}
          className={
            tone === 'dark'
              ? 'w-full rounded-[1.2rem] border border-stone-200/12 bg-white/8 px-10 py-3 text-sm text-stone-50 outline-none transition placeholder:text-stone-300/35 focus:border-amber-300/60 focus:bg-white/10'
              : 'w-full rounded-[1.2rem] border border-stone-300/70 bg-white/86 px-10 py-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-amber-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950/60 dark:text-white'
          }
        />
        {isLoading ? (
          <Loader2
            className={
              tone === 'dark'
                ? 'absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-amber-200/70'
                : 'absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400 dark:text-slate-400'
            }
          />
        ) : null}
      </div>
      {isOpen ? (
        <div
          id={listId}
          className={
            tone === 'dark'
              ? 'absolute top-full z-20 mt-2 max-h-64 w-full overflow-auto rounded-[1.3rem] border border-amber-200/15 bg-[#0d1824]/96 p-2 shadow-[0_20px_50px_rgba(7,17,28,0.35)]'
              : 'absolute top-full z-20 mt-2 max-h-64 w-full overflow-auto rounded-[1.3rem] border border-stone-300/80 bg-white/96 p-2 shadow-[0_20px_50px_rgba(72,56,32,0.18)] dark:border-slate-800 dark:bg-slate-950/95'
          }
        >
          {results.map((system) => (
            <button
              key={system.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(system)}
              className={
                tone === 'dark'
                  ? 'flex w-full flex-col rounded-xl px-3 py-2 text-left transition hover:bg-white/6'
                  : 'flex w-full flex-col rounded-xl px-3 py-2 text-left transition hover:bg-stone-100 dark:hover:bg-slate-900'
              }
            >
              <span
                className={
                  tone === 'dark'
                    ? 'font-medium text-stone-50'
                    : 'font-medium text-stone-950 dark:text-slate-100'
                }
              >
                {system.name}
              </span>
              <span
                className={
                  tone === 'dark'
                    ? 'text-xs text-stone-300/60'
                    : 'text-xs text-stone-500 dark:text-slate-400'
                }
              >
                #{system.id} · constellation {system.constellationId} · region{' '}
                {system.regionId}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
