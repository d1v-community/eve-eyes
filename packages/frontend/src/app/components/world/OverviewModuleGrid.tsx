'use client'

import {
  ArrowRight,
  ArrowRightLeft,
  Binary,
  Map,
  ShieldCheck,
  ShipWheel,
  Swords,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type ModuleSummaryItem = {
  title: 'Atlas' | 'Verify' | 'Fleet' | 'Codex' | 'Tribes' | 'Jumps'
  href: string
  description: string
  metric: string
  supporting: string
  status: 'live' | 'attention' | 'locked'
}

type ModuleSummaryResponse = {
  modules?: ModuleSummaryItem[]
  error?: string
}

const moduleIcons = {
  Atlas: Map,
  Verify: ShieldCheck,
  Fleet: ShipWheel,
  Codex: Binary,
  Tribes: Swords,
  Jumps: ArrowRightLeft,
} as const

const statusStyles = {
  live: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300',
  attention:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300',
  locked:
    'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
} as const

const skeletonCards = Array.from({ length: 6 }, (_, index) => index)

export default function OverviewModuleGrid() {
  const [modules, setModules] = useState<ModuleSummaryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadModules() {
      try {
        const response = await fetch('/api/world/modules-summary', {
          cache: 'no-store',
        })
        const payload = (await response.json()) as ModuleSummaryResponse

        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to load module summaries')
        }

        if (!cancelled) {
          setModules(payload.modules ?? [])
          setError(null)
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Failed to load module summaries'
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadModules()

    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return (
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {skeletonCards.map((card) => (
          <article
            key={card}
            className="rounded-[1.3rem] border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/60"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-slate-100 dark:bg-slate-900" />
            </div>
            <div className="mt-3 h-8 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-3 h-6 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
            <div className="mt-3 h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
          </article>
        ))}
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-[1.75rem] border border-red-200 bg-red-50/80 p-5 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
        {error}
      </section>
    )
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map((module) => {
        const Icon = moduleIcons[module.title]

        return (
          <Link
            key={module.href}
            href={module.href}
            className="group rounded-[1.3rem] border border-slate-200/70 bg-white/78 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-white/92 hover:shadow-[0_18px_36px_rgba(56,189,248,0.1)] dark:border-slate-800 dark:bg-slate-950/55 dark:hover:border-sky-700 dark:hover:bg-slate-950/72"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-xl border border-sky-200/70 bg-sky-50/70 p-2.5 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-slate-950 dark:text-white">
                    {module.title}
                  </h2>
                  <div className="mt-0.5 text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    {module.href}
                  </div>
                </div>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] ${statusStyles[module.status]}`}
              >
                {module.status}
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {module.metric}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Snapshot
                </div>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-sky-500 dark:text-slate-500 dark:group-hover:text-sky-300" />
            </div>

            <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
              {module.supporting}
            </p>
          </Link>
        )
      })}
    </section>
  )
}
