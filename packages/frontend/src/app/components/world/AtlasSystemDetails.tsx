'use client'

import { ArrowRight, MapPinned, Radar, Route } from 'lucide-react'
import type { AtlasDetailedSolarSystem } from '../../world/types'

type Props = {
  system: AtlasDetailedSolarSystem | null
  isLoading: boolean
  error: string | null
  onSelectSystemId?: (systemId: number) => void
  onSetOrigin?: (system: AtlasDetailedSolarSystem['gateLinks'][number]['destination']) => void
  onSetDestination?: (system: AtlasDetailedSolarSystem['gateLinks'][number]['destination']) => void
}

export default function AtlasSystemDetails({
  system,
  isLoading,
  error,
  onSelectSystemId,
  onSetOrigin,
  onSetDestination,
}: Props) {
  const showEmpty = !isLoading && error == null && system == null

  return (
    <div className="rounded-[1.6rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(255,252,246,0.88),rgba(247,242,234,0.72))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(5,12,24,0.97))]">
        <div className="mb-4 flex items-center gap-3">
        <Radar className="h-5 w-5 text-amber-700 dark:text-sky-300" />
        <div>
          <div className="font-display text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-slate-400">
            Node intel
          </div>
          <div className="font-display text-base font-medium tracking-[-0.02em] text-stone-950 dark:text-slate-100">
            {system?.name ?? 'Select a route node'}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="font-body flex items-center gap-2 text-sm text-stone-600 dark:text-slate-300">
            <Route className="h-4 w-4 animate-pulse" />
            Loading node details...
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sds-skeleton h-16 rounded-2xl" />
            <div className="sds-skeleton h-16 rounded-2xl" />
            <div className="sds-skeleton h-16 rounded-2xl" />
          </div>
          <div className="sds-skeleton h-20 rounded-2xl" />
          <div className="grid gap-2">
            <div className="sds-skeleton h-24 rounded-2xl" />
            <div className="sds-skeleton h-24 rounded-2xl" />
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="font-body rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {system ? (
        <div className="space-y-4 text-sm text-stone-600 dark:text-slate-300">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="font-body rounded-2xl border border-stone-300/70 bg-white/80 p-3 dark:border-slate-700/80 dark:bg-[rgba(10,18,32,0.92)]">
              Constellation {system.constellationId}
            </div>
            <div className="font-body rounded-2xl border border-stone-300/70 bg-white/80 p-3 dark:border-slate-700/80 dark:bg-[rgba(10,18,32,0.92)]">
              Region {system.regionId}
            </div>
            <div className="font-body rounded-2xl border border-stone-300/70 bg-white/80 p-3 dark:border-slate-700/80 dark:bg-[rgba(10,18,32,0.92)]">
              Gates {system.gateLinks.length}
            </div>
          </div>
          <div className="rounded-2xl border border-stone-300/70 bg-white/80 p-3 dark:border-slate-700/80 dark:bg-[rgba(10,18,32,0.92)]">
            <span className="font-data">
            Coordinates {Math.round(system.location.x / 1e12)}k /{' '}
            {Math.round(system.location.y / 1e12)}k /{' '}
            {Math.round(system.location.z / 1e12)}k
            </span>
          </div>
          <div className="grid gap-2">
            {system.gateLinks.length > 0 ? (
              system.gateLinks.map((gate) => (
                <div
                  key={gate.id}
                  className="rounded-2xl border border-stone-300/70 bg-white/80 px-4 py-3 dark:border-slate-700/80 dark:bg-[rgba(10,18,32,0.92)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display font-medium tracking-[-0.02em] text-stone-950 dark:text-slate-100">
                        {gate.destination.name}
                      </div>
                      <div className="font-data text-xs text-stone-500 dark:text-slate-400">
                        {gate.name} · constellation {gate.destination.constellationId} ·
                        region {gate.destination.regionId}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectSystemId?.(gate.destination.id)}
                      className="font-display inline-flex items-center gap-1 rounded-full border border-stone-300/80 bg-stone-50/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.28em] text-stone-500 transition hover:border-amber-300 hover:text-amber-700 dark:border-slate-700 dark:bg-[rgba(15,23,42,0.96)] dark:text-slate-300 dark:hover:border-sky-700"
                    >
                      <MapPinned className="h-3 w-3" />
                      Focus
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSetOrigin?.(gate.destination)}
                      className="font-display inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-300"
                    >
                      Origin
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetDestination?.(gate.destination)}
                      className="font-display inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-amber-800 transition hover:bg-amber-100 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-300"
                    >
                      Destination
                    </button>
                    <div className="font-data inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.28em] text-stone-400 dark:text-slate-500">
                      <ArrowRight className="h-3 w-3" />
                      #{gate.destination.id}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="font-body rounded-2xl border border-dashed border-stone-300 px-4 py-3 dark:border-slate-700 dark:bg-[rgba(8,16,28,0.88)]">
                No outbound gate links in this payload.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <div className="font-body rounded-[1.2rem] border border-dashed border-stone-300 px-4 py-4 text-sm leading-6 text-stone-600 dark:border-slate-700 dark:bg-[rgba(8,16,28,0.88)] dark:text-slate-300">
          Hover any system for preview, then click to lock focus and load its gate
          neighbors. This panel becomes your local sector briefing.
        </div>
      ) : null}
    </div>
  )
}
