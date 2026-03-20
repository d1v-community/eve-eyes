'use client'

import { ArrowRight, MapPinned, Radar, Route } from 'lucide-react'

type GateLink = {
  id: number
  name: string
  destination: {
    id: number
    name: string
    constellationId: number
    regionId: number
  }
}

type DetailedSolarSystem = {
  id: number
  name: string
  constellationId: number
  regionId: number
  location: {
    x: number
    y: number
    z: number
  }
  gateLinks: GateLink[]
}

type Props = {
  system: DetailedSolarSystem | null
  isLoading: boolean
  error: string | null
  onSelectSystemId?: (systemId: number) => void
  onSetOrigin?: (system: DetailedSolarSystem['gateLinks'][number]['destination']) => void
  onSetDestination?: (system: DetailedSolarSystem['gateLinks'][number]['destination']) => void
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
    <div className="rounded-[1.75rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-4 flex items-center gap-3">
        <Radar className="h-5 w-5 text-sky-600 dark:text-sky-300" />
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Node intel
          </div>
          <div className="text-base font-medium text-slate-900 dark:text-slate-100">
            {system?.name ?? 'Select a route node'}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
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
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {system ? (
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              Constellation {system.constellationId}
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              Region {system.regionId}
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              Gates {system.gateLinks.length}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
            Coordinates {Math.round(system.location.x / 1e12)}k /{' '}
            {Math.round(system.location.y / 1e12)}k /{' '}
            {Math.round(system.location.z / 1e12)}k
          </div>
          <div className="grid gap-2">
            {system.gateLinks.length > 0 ? (
              system.gateLinks.map((gate) => (
                <div
                  key={gate.id}
                  className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {gate.destination.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {gate.name} · constellation {gate.destination.constellationId} ·
                        region {gate.destination.regionId}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectSystemId?.(gate.destination.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-500 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-700"
                    >
                      <MapPinned className="h-3 w-3" />
                      Focus
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSetOrigin?.(gate.destination)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
                    >
                      Origin
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetDestination?.(gate.destination)}
                      className="inline-flex items-center gap-1 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300"
                    >
                      Destination
                    </button>
                    <div className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      <ArrowRight className="h-3 w-3" />
                      #{gate.destination.id}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 dark:border-slate-700">
                No outbound gate links in this payload.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <div className="rounded-[1.2rem] border border-dashed border-slate-300 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Hover any system for preview, then click to lock focus and load its gate
          neighbors. This panel becomes your local sector briefing.
        </div>
      ) : null}
    </div>
  )
}
