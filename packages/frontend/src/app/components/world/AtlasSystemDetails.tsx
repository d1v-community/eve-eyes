'use client'

import { Loader2, Radar } from 'lucide-react'

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
}

export default function AtlasSystemDetails({
  system,
  isLoading,
  error,
}: Props) {
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
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading node details...
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
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {gate.destination.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {gate.name} · constellation {gate.destination.constellationId} ·
                    region {gate.destination.regionId}
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
    </div>
  )
}
