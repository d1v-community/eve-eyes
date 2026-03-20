'use client'

import { Loader2, Search } from 'lucide-react'
import { useDeferredValue, useEffect, useId, useState } from 'react'

type SystemSearchResult = {
  id: number
  name: string
  constellationId: number
  regionId: number
}

type Props = {
  label: string
  placeholder: string
  selected: SystemSearchResult | null
  onSelect: (system: SystemSearchResult | null) => void
}

export default function SystemSearchInput({
  label,
  placeholder,
  selected,
  onSelect,
}: Props) {
  const [query, setQuery] = useState(selected?.name ?? '')
  const [results, setResults] = useState<SystemSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const deferredQuery = useDeferredValue(query)
  const listId = useId()

  useEffect(() => {
    setQuery(selected?.name ?? '')
  }, [selected])

  useEffect(() => {
    if (deferredQuery.trim().length < 2) {
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
          data?: SystemSearchResult[]
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
  }, [deferredQuery])

  return (
    <div className="relative flex flex-col gap-2">
      <label className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          aria-autocomplete="list"
          aria-controls={listId}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)

            if (selected?.name !== event.target.value) {
              onSelect(null)
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-slate-200/80 bg-white/85 px-10 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-white"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : null}
      </div>
      {results.length > 0 ? (
        <div
          id={listId}
          className="absolute top-full z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_20px_50px_rgba(15,23,42,0.15)] dark:border-slate-800 dark:bg-slate-950/95"
        >
          {results.map((system) => (
            <button
              key={system.id}
              type="button"
              onClick={() => {
                onSelect(system)
                setResults([])
              }}
              className="flex w-full flex-col rounded-xl px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {system.name}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
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
