'use client'

import { Orbit, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

const numberFormatter = new Intl.NumberFormat('en-US')
const COUNT_UP_DURATION_MS = 1200

type OverviewSystemFootprintProps = {
  totalConstellations: number
  totalSystems: number
  signingKey: string | null
}

type MetricKey = 'systems' | 'constellations'

function animateValue(from: number, to: number, progress: number) {
  return Math.round(from + (to - from) * progress)
}

export default function OverviewSystemFootprint({
  totalConstellations,
  totalSystems,
  signingKey,
}: OverviewSystemFootprintProps) {
  const [animatedMetrics, setAnimatedMetrics] = useState<Record<MetricKey, number>>({
    systems: 0,
    constellations: 0,
  })
  const animationFrameRef = useRef<number | null>(null)
  const animatedMetricsRef = useRef(animatedMetrics)

  const targetMetrics = useMemo(
    () => ({
      systems: totalSystems,
      constellations: totalConstellations,
    }),
    [totalConstellations, totalSystems]
  )

  useEffect(() => {
    animatedMetricsRef.current = animatedMetrics
  }, [animatedMetrics])

  useEffect(() => {
    const startingMetrics = { ...animatedMetricsRef.current }
    const startedAt = performance.now()

    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / COUNT_UP_DURATION_MS, 1)
      const easedProgress = 1 - (1 - progress) * (1 - progress)

      setAnimatedMetrics({
        systems: animateValue(startingMetrics.systems, targetMetrics.systems, easedProgress),
        constellations: animateValue(
          startingMetrics.constellations,
          targetMetrics.constellations,
          easedProgress
        ),
      })

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(tick)
      } else {
        animationFrameRef.current = null
      }
    }

    animationFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [targetMetrics])

  return (
    <div className="mt-8 rounded-[1.55rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(240,249,255,0.82))] p-4 transition duration-200 hover:border-sky-300 hover:shadow-[0_18px_40px_rgba(56,189,248,0.12)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.72),rgba(15,23,42,0.64))] dark:hover:border-sky-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            System footprint
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Universe coverage and trust state, compressed into one read.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-sky-200/70 bg-sky-50/70 p-2.5 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300">
            <Orbit className="h-4 w-4" />
          </div>
          <div className="rounded-xl border border-sky-200/70 bg-sky-50/70 p-2.5 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.15rem] border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/45">
          <div className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {numberFormatter.format(animatedMetrics.systems)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Systems
          </div>
        </div>
        <div className="rounded-[1.15rem] border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/45">
          <div className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {numberFormatter.format(animatedMetrics.constellations)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Constellations
          </div>
        </div>
        <div className="rounded-[1.15rem] border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/45">
          <div className="truncate text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {signingKey?.slice(0, 12) ?? 'Unavailable'}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Verify key
          </div>
        </div>
      </div>
    </div>
  )
}
