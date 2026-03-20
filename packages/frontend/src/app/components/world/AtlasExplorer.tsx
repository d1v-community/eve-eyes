'use client'

import {
  ArrowRightLeft,
  Crosshair,
  Loader2,
  Orbit,
  Route,
  Sparkles,
} from 'lucide-react'
import { startTransition, useMemo, useState } from 'react'
import OverviewSpatialAtlas from './OverviewSpatialAtlas'
import SystemSearchInput from './SystemSearchInput'

type MapSystem = {
  id: number
  name: string
  constellationId: number
  regionId: number
  location: {
    x: number
    y: number
    z: number
  }
}

type SearchSystem = Pick<MapSystem, 'id' | 'name' | 'constellationId' | 'regionId'>

type MapConstellation = {
  id: number
  name: string
  regionId: number
  location: {
    x: number
    y: number
    z: number
  }
}

type MapLink = {
  fromId: number
  toId: number
  toConstellationId: number
}

type RouteNode = MapSystem

type RouteResponse = {
  path: RouteNode[]
  hops: number
  explored: number
}

type AtlasExplorerProps = {
  systems: MapSystem[]
  constellations: MapConstellation[]
  gateLinks: MapLink[]
}

function hasLocation(system: SearchSystem | MapSystem): system is MapSystem {
  return 'location' in system
}

export default function AtlasExplorer({
  systems,
  constellations,
  gateLinks,
}: AtlasExplorerProps) {
  const [origin, setOrigin] = useState<SearchSystem | null>(systems[0] ?? null)
  const [destination, setDestination] = useState<SearchSystem | null>(systems[1] ?? null)
  const [hoveredSystem, setHoveredSystem] = useState<MapSystem | null>(null)
  const [focusedSystemId, setFocusedSystemId] = useState<number | null>(null)
  const [route, setRoute] = useState<RouteResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const canSearch =
    origin != null && destination != null && origin.id !== destination.id

  const highlightedPathIds = route?.path.map((system) => system.id) ?? []

  const routeSystemsById = useMemo(
    () => new Map(route?.path.map((system) => [system.id, system]) ?? []),
    [route]
  )

  const allSystemsById = useMemo(
    () => new Map(systems.map((system) => [system.id, system])),
    [systems]
  )

  const selectedSystem =
    (focusedSystemId != null
      ? routeSystemsById.get(focusedSystemId) ?? allSystemsById.get(focusedSystemId)
      : null) ??
    hoveredSystem ??
    destination ??
    origin

  const detailedSelectedSystem =
    (selectedSystem != null ? allSystemsById.get(selectedSystem.id) : null) ??
    (selectedSystem != null && hasLocation(selectedSystem) ? selectedSystem : null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSearch) {
      setError('Choose two different solar systems to calculate a route.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/world/route?originId=${origin.id}&destinationId=${destination.id}`
      )
      const payload = (await response.json()) as RouteResponse & {
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Route search failed')
      }

      startTransition(() => {
        setRoute(payload)
        setFocusedSystemId(payload.path[payload.path.length - 1]?.id ?? null)
      })
    } catch (requestError) {
      setRoute(null)
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Route search failed'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.42fr_0.58fr]">
      <section className="flex flex-col gap-5 rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
        <div className="space-y-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
            <Sparkles className="h-3.5 w-3.5" />
            Atlas
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Navigate the universe in 3D.
          </h1>
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
            This page now uses the real system coordinates for the main atlas,
            while route search still runs on the server against live gate-link
            expansion.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <SystemSearchInput
            label="Origin"
            placeholder="Search a starting solar system"
            selected={origin}
            onSelect={(system) => {
              setOrigin(system)
              setFocusedSystemId(system?.id ?? null)
            }}
          />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  setOrigin(destination)
                  setDestination(origin)
                  setFocusedSystemId(destination?.id ?? origin?.id ?? null)
                  setRoute(null)
                  setError(null)
                })
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Swap systems
            </button>
          </div>
          <SystemSearchInput
            label="Destination"
            placeholder="Search a destination solar system"
            selected={destination}
            onSelect={(system) => {
              setDestination(system)
              setFocusedSystemId(system?.id ?? null)
            }}
          />
          <button
            type="submit"
            disabled={!canSearch || isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Route className="h-4 w-4" />
            )}
            {isLoading ? 'Calculating route...' : 'Plot route'}
          </button>
        </form>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <article className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Systems in scene
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              {systems.length}
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Constellations
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              {constellations.length}
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Sample links
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              {gateLinks.length}
            </div>
          </article>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {route ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Route output
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                  {route.hops} hops
                </div>
              </div>
              <div className="rounded-full border border-slate-200/80 px-3 py-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                Explored {route.explored}
              </div>
            </div>

            <div className="max-h-[320px] space-y-3 overflow-auto pr-1">
              {route.path.map((system, index) => (
                <button
                  key={system.id}
                  type="button"
                  onClick={() => setFocusedSystemId(system.id)}
                  className="block w-full rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-left transition hover:border-sky-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-sky-700"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-lg font-medium text-slate-900 dark:text-slate-100">
                        {system.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        #{system.id} · constellation {system.constellationId} · region{' '}
                        {system.regionId}
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                      Stop {index + 1}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Search two systems to project the route directly onto the 3D atlas.
            Click any route stop to lock the system in the side panel.
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75 md:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Spatial atlas
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
              Real coordinates, live route overlay
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <Orbit className="h-4 w-4" />
            React Three Fiber
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/70 dark:border-slate-800">
          <OverviewSpatialAtlas
            systems={systems}
            gateLinks={gateLinks.map((link) => ({
              fromId: link.fromId,
              toId: link.toId,
            }))}
            highlightedPathIds={highlightedPathIds}
            selectedSystemId={focusedSystemId}
            onSelectSystemId={setFocusedSystemId}
            onHoverSystem={setHoveredSystem}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[1.5rem] border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
              <Crosshair className="h-3.5 w-3.5" />
              Focus
            </div>
            <div className="text-2xl font-semibold text-slate-950 dark:text-white">
              {selectedSystem?.name ?? 'No system selected'}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {selectedSystem
                ? `System #${selectedSystem.id} in constellation ${selectedSystem.constellationId}, region ${selectedSystem.regionId}.`
                : 'Hover or click systems in the atlas to inspect them.'}
            </div>
            {detailedSelectedSystem ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50">
                  X {Math.round(detailedSelectedSystem.location.x / 1e12)}k
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50">
                  Y {Math.round(detailedSelectedSystem.location.y / 1e12)}k
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50">
                  Z {Math.round(detailedSelectedSystem.location.z / 1e12)}k
                </div>
              </div>
            ) : null}
          </article>

          <article className="rounded-[1.5rem] border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Why this view works
            </div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <p>
                Your API already provides physical coordinates, so the main atlas
                should preserve real spacing instead of forcing the universe into
                an abstract graph.
              </p>
              <p>
                Gate links stay visible as low-opacity structure. When a route is
                calculated, the selected path is promoted into a bright overlay
                without discarding the surrounding spatial context.
              </p>
              <p>
                This is the right base for later camera flights, constellation
                halos, faction overlays, or private jump heatmaps.
              </p>
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}
