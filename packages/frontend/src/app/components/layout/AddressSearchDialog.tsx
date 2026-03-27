'use client'

import { Search, Sparkles } from 'lucide-react'
import { startTransition, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{1,64}$/

function normalizeAddress(value: string) {
  return value.trim().toLowerCase()
}

export default function AddressSearchDialog() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    inputRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleSubmit = () => {
    const normalized = normalizeAddress(value)

    if (!ADDRESS_PATTERN.test(normalized)) {
      setError('Please enter a valid Sui wallet or object address.')
      return
    }

    setError(null)
    setIsOpen(false)
    startTransition(() => {
      router.push(`/history/${encodeURIComponent(normalized)}`)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
        aria-label="Search wallet or object address"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/45 px-4 py-20 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-6 shadow-[0_32px_120px_rgba(15,23,42,0.3)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.2),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-display inline-flex items-center gap-2 rounded-full border border-sky-300/70 bg-sky-100/85 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/45 dark:text-sky-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Address Search
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
                  Jump straight into an address timeline
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                  Paste a user wallet or object address. The history page will resolve
                  matching activity records and sort the event flow from newest to oldest.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-6 rounded-[1.6rem] border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <label className="sr-only" htmlFor="address-search-input">
                Wallet or object address
              </label>
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  id="address-search-input"
                  ref={inputRef}
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value)
                    if (error) {
                      setError(null)
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleSubmit()
                    }
                  }}
                  placeholder="0x..."
                  className="min-h-[3.5rem] flex-1 rounded-[1.2rem] border border-slate-200 bg-slate-50/80 px-4 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-sky-600"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="inline-flex min-h-[3.5rem] items-center justify-center rounded-[1.2rem] bg-[linear-gradient(135deg,#0f172a,#0369a1)] px-5 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(3,105,161,0.32)] transition hover:-translate-y-0.5 dark:bg-[linear-gradient(135deg,#e2e8f0,#38bdf8)] dark:text-slate-950"
                >
                  Open history
                </button>
              </div>
              {error ? (
                <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>
              ) : (
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Supports wallet and object addresses
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
