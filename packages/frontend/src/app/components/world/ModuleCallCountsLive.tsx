'use client'

import { Activity, Radio, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

const numberFormatter = new Intl.NumberFormat('en-US')
const POLL_INTERVAL_MS = 5000
const REFRESH_FLASH_MS = 1400

type ModuleCallCountItem = {
  moduleName: string
  callCount: number
  latestTransactionTime: string | null
}

type ModuleCallCountsResponse = {
  modules?: ModuleCallCountItem[]
  error?: string
}

function buildFingerprint(modules: ModuleCallCountItem[]) {
  return JSON.stringify(
    modules.map((module) => [
      module.moduleName,
      module.callCount,
      module.latestTransactionTime,
    ])
  )
}

export default function ModuleCallCountsLive({
  initialModules,
}: {
  initialModules: ModuleCallCountItem[]
}) {
  const [modules, setModules] = useState(initialModules)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(() => new Date())
  const [refreshToken, setRefreshToken] = useState(0)
  const fingerprintRef = useRef(buildFingerprint(initialModules))
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch('/api/indexer/module-call-counts', {
          cache: 'no-store',
        })
        const payload = (await response.json().catch(() => ({}))) as ModuleCallCountsResponse

        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to refresh module call counts')
        }

        const nextModules = payload.modules ?? []
        const nextFingerprint = buildFingerprint(nextModules)

        if (cancelled) return

        setErrorMessage(null)
        setLastUpdatedAt(new Date())

        if (nextFingerprint !== fingerprintRef.current) {
          fingerprintRef.current = nextFingerprint
          setModules(nextModules)
          setRefreshToken((value) => value + 1)
          setIsRefreshing(true)

          if (flashTimeoutRef.current != null) {
            clearTimeout(flashTimeoutRef.current)
          }

          flashTimeoutRef.current = setTimeout(() => {
            setIsRefreshing(false)
          }, REFRESH_FLASH_MS)
        }
      } catch (error) {
        if (cancelled) return
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to refresh module call counts'
        )
      }
    }

    const intervalId = setInterval(() => {
      void load()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)

      if (flashTimeoutRef.current != null) {
        clearTimeout(flashTimeoutRef.current)
      }
    }
  }, [])

  const totalCalls = useMemo(
    () => modules.reduce((sum, module) => sum + module.callCount, 0),
    [modules]
  )

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          isRefreshing ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(16,185,129,0.16),transparent_20%),radial-gradient(circle_at_50%_100%,rgba(250,204,21,0.14),transparent_28%)]" />
        <div className="absolute inset-y-0 -left-1/3 w-1/3 animate-[module-scan_1.2s_ease-out] bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.45),transparent)] blur-2xl" />
      </div>

      <div className="relative mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
            Indexer
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            Module Call Counts
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Counts are derived from successful on-chain move call records stored in
            `suiscan_move_calls`.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.26em] ${
              isRefreshing
                ? 'border-cyan-300/80 bg-cyan-50 text-cyan-700 dark:border-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-200'
                : 'border-emerald-300/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
            }`}
          >
            {isRefreshing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Radio className="h-3.5 w-3.5" />
            )}
            {isRefreshing ? 'syncing' : 'live every 5s'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lastUpdatedAt
              ? `Updated ${lastUpdatedAt.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}`
              : 'Waiting for first refresh'}
          </div>
        </div>
      </div>

      <div className="relative mb-4 grid gap-3 md:grid-cols-3">
        <article className="rounded-[1.3rem] border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Modules tracked
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {modules.length}
          </div>
        </article>
        <article
          className={`rounded-[1.3rem] border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60 ${
            isRefreshing ? 'animate-pulse' : ''
          }`}
        >
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            <Activity className="h-3.5 w-3.5" />
            Total indexed calls
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 transition-transform duration-500 dark:text-white">
            {numberFormatter.format(totalCalls)}
          </div>
        </article>
        <article className="rounded-[1.3rem] border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            <Sparkles className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-pulse' : ''}`} />
            Refresh mode
          </div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            Diff-aware polling
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Animation only fires when the payload actually changes.
          </div>
        </article>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-[1.2rem] border border-red-300/70 bg-red-50/90 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((module, index) => (
          <article
            key={`${module.moduleName}-${refreshToken}`}
            className={`group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 transition-all duration-500 dark:border-slate-800 dark:bg-slate-900/60 ${
              isRefreshing
                ? 'scale-[1.02] border-cyan-300/70 shadow-[0_16px_38px_rgba(14,165,233,0.16)] dark:border-cyan-800'
                : 'shadow-none'
            }`}
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div
              className={`pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(56,189,248,0.08),transparent_35%,rgba(250,204,21,0.08))] transition-opacity duration-500 ${
                isRefreshing ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <div className="relative text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              {module.moduleName}
            </div>
            <div
              className={`relative mt-3 text-3xl font-semibold text-slate-950 transition-all duration-500 dark:text-white ${
                isRefreshing ? 'translate-y-0 scale-105' : 'translate-y-0 scale-100'
              }`}
            >
              {numberFormatter.format(module.callCount)}
            </div>
            <p className="relative mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
              Latest tx:{' '}
              {module.latestTransactionTime
                ? new Date(module.latestTransactionTime).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'No data yet'}
            </p>
          </article>
        ))}
      </div>

      <style jsx>{`
        @keyframes module-scan {
          0% {
            transform: translateX(0) skewX(-18deg);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: translateX(420%) skewX(-18deg);
            opacity: 0;
          }
        }
      `}</style>
    </section>
  )
}
