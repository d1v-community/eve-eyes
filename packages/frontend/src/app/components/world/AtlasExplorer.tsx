'use client'

import {
  ArrowRightLeft,
  Copy,
  Crosshair,
  Eye,
  GitBranch,
  Loader2,
  LocateFixed,
  Orbit,
  Route,
  Sparkles,
  Target,
} from 'lucide-react'
import { startTransition, useEffect, useMemo, useState } from 'react'
import AtlasSystemDetails from './AtlasSystemDetails'
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

type DetailedSolarSystem = MapSystem & {
  gateLinks: Array<{
    id: number
    name: string
    destination: {
      id: number
      name: string
      constellationId: number
      regionId: number
    }
  }>
}

type AtlasExplorerProps = {
  systems: MapSystem[]
  constellations: MapConstellation[]
  gateLinks: MapLink[]
}

function hasLocation(system: SearchSystem | MapSystem): system is MapSystem {
  return 'location' in system
}

function formatCoordinate(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value / 1e12)
}

function MetricCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <article className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </article>
  )
}

function EmptyPulseCard({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-white/60 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/30">
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {body}
      </div>
      <div className="mt-4 grid gap-2">
        <div className="sds-skeleton h-2.5 w-4/5 rounded-full" />
        <div className="sds-skeleton h-2.5 w-3/5 rounded-full" />
      </div>
    </div>
  )
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
  const [detailSystem, setDetailSystem] = useState<DetailedSolarSystem | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showGateLinks, setShowGateLinks] = useState(true)
  const [routeOnly, setRouteOnly] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)

  const canSearch =
    origin != null && destination != null && origin.id !== destination.id

  const highlightedPathIds = useMemo(
    () => route?.path.map((system) => system.id) ?? [],
    [route]
  )

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

  const highlightedSet = useMemo(() => new Set(highlightedPathIds), [highlightedPathIds])

  const selectedGateLinkCount = useMemo(() => {
    if (selectedSystem == null) return 0

    return gateLinks.filter(
      (link) => link.fromId === selectedSystem.id || link.toId === selectedSystem.id
    ).length
  }, [gateLinks, selectedSystem])

  const routeDensityLabel = route
    ? `${route.hops} hops across ${route.path.length} systems`
    : 'Route overlay inactive'

  const routeConstellationCount = useMemo(() => {
    if (route == null) return 0
    return new Set(route.path.map((system) => system.constellationId)).size
  }, [route])

  const routeRegionCount = useMemo(() => {
    if (route == null) return 0
    return new Set(route.path.map((system) => system.regionId)).size
  }, [route])

  const selectedConstellation = useMemo(() => {
    if (selectedSystem == null) return null
    return (
      constellations.find((constellation) => constellation.id === selectedSystem.constellationId) ??
      null
    )
  }, [constellations, selectedSystem])

  useEffect(() => {
    if (selectedSystem == null) {
      setDetailSystem(null)
      setDetailError(null)
      setIsDetailLoading(false)
      return
    }

    const controller = new AbortController()

    const loadDetails = async () => {
      setIsDetailLoading(true)
      setDetailError(null)

      try {
        const response = await fetch(`/api/world/systems/${selectedSystem.id}`, {
          signal: controller.signal,
        })
        const payload = (await response.json()) as DetailedSolarSystem & {
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to load system details')
        }

        setDetailSystem(payload)
      } catch (requestError) {
        if ((requestError as Error).name === 'AbortError') return

        setDetailSystem(null)
        setDetailError(
          requestError instanceof Error
            ? requestError.message
            : 'Failed to load system details'
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsDetailLoading(false)
        }
      }
    }

    void loadDetails()

    return () => controller.abort()
  }, [selectedSystem])

  useEffect(() => {
    if (!copied) return

    const timeout = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timeout)
  }, [copied])

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

  const handleCopyRoute = async () => {
    if (route == null) return

    const content = route.path
      .map((system, index) => `${index + 1}. ${system.name} (#${system.id})`)
      .join('\n')

    await navigator.clipboard.writeText(
      `Route from ${route.path[0]?.name} to ${route.path[route.path.length - 1]?.name}\nHops: ${route.hops}\n\n${content}`
    )
    setCopied(true)
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(145deg,rgba(248,250,252,0.98),rgba(226,232,240,0.84))] shadow-[0_28px_100px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-[linear-gradient(145deg,rgba(2,6,23,0.96),rgba(15,23,42,0.88))]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_26%),radial-gradient(circle_at_70%_20%,rgba(14,165,233,0.10),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(15,23,42,0.08),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_70%_20%,rgba(14,165,233,0.12),transparent_20%),radial-gradient(circle_at_50%_100%,rgba(96,165,250,0.08),transparent_36%)]" />

      <div className="relative grid gap-5 p-3 lg:p-4 xl:grid-cols-[22rem_minmax(0,1fr)_20rem]">
        <section className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200/70 bg-slate-950 px-5 py-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:border-white/10">
          <div className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-sky-100">
              <Sparkles className="h-3.5 w-3.5" />
              Atlas Command
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Spatial route navigation
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                参考 `karum-frontend` 的地图主舞台结构，把搜索、路径规划和场景状态从地图里分层拆开，降低操作噪音。
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <SystemSearchInput
              label="Origin"
              placeholder="Search a starting solar system"
              selected={origin}
              onSelect={(system) => {
                setOrigin(system)
                setFocusedSystemId(system?.id ?? null)
              }}
            />
            <div className="flex items-center gap-2">
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
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/40 hover:bg-white/10"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Swap
              </button>
              <button
                type="button"
                onClick={() => {
                  setFocusedSystemId(null)
                  setRoute(null)
                  setError(null)
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-sky-300/40 hover:bg-white/10"
              >
                Reset
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-[1.1rem] bg-sky-500 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200"
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
            <MetricCard label="Systems" value={systems.length} />
            <MetricCard label="Constellations" value={constellations.length} />
            <MetricCard label="Gate links" value={gateLinks.length} />
          </div>

          <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
              Map state
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-200">
              {routeDensityLabel}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFocusedSystemId(origin?.id ?? null)}
                disabled={origin == null}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Target className="h-3.5 w-3.5" />
                Origin
              </button>
              <button
                type="button"
                onClick={() => setFocusedSystemId(destination?.id ?? null)}
                disabled={destination == null}
                className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                Destination
              </button>
              <button
                type="button"
                onClick={() => {
                  if (route == null) return
                  setFocusedSystemId(route.path[0]?.id ?? null)
                }}
                disabled={route == null}
                className="inline-flex items-center gap-2 rounded-full border border-sky-200/25 bg-sky-200/10 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-sky-100 transition hover:bg-sky-200/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Crosshair className="h-3.5 w-3.5" />
                Route start
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-[1.4rem] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}
        </section>

        <section className="min-w-0 rounded-[1.9rem] border border-slate-200/70 bg-white/75 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/55">
          <div className="mb-3 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200/70 bg-white/70 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/55 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Spatial Atlas
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Real coordinates with route-first focus
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              <Orbit className="h-3.5 w-3.5" />
              Camera fly-through enabled
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowGateLinks((value) => !value)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
            >
              <GitBranch className="h-3.5 w-3.5" />
              {showGateLinks ? 'Hide links' : 'Show links'}
            </button>
            <button
              type="button"
              onClick={() => setRouteOnly((value) => !value)}
              disabled={route == null}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
            >
              <Eye className="h-3.5 w-3.5" />
              {routeOnly ? 'Full map' : 'Route only'}
            </button>
            <button
              type="button"
              onClick={() => setResetSignal((value) => value + 1)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
            >
              <Crosshair className="h-3.5 w-3.5" />
              Reset view
            </button>
          </div>

          {route == null ? (
            <div className="mb-3 rounded-[1rem] border border-dashed border-slate-300/80 bg-white/55 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
              Route-only focus unlocks after the first route is calculated.
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[1.65rem] border border-slate-200/70 dark:border-slate-800">
            <OverviewSpatialAtlas
              systems={systems}
              gateLinks={gateLinks.map((link) => ({
                fromId: link.fromId,
                toId: link.toId,
              }))}
              highlightedPathIds={highlightedPathIds}
              selectedSystemId={focusedSystemId}
              originSystemId={origin?.id ?? null}
              destinationSystemId={destination?.id ?? null}
              showGateLinks={showGateLinks}
              routeOnly={routeOnly}
              resetSignal={resetSignal}
              onSelectSystemId={setFocusedSystemId}
              onHoverSystem={setHoveredSystem}
            />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <article className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Focus target
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                {selectedSystem?.name ?? 'No system selected'}
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {selectedSystem
                  ? `Constellation ${selectedSystem.constellationId} · Region ${selectedSystem.regionId}`
                  : 'Hover or click any node to inspect the sector.'}
              </div>
            </article>
            <article className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Linked edges
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                {selectedGateLinkCount}
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Gate structure touching the current focus node.
              </div>
            </article>
            <article className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Path coverage
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                {route ? route.path.length : 0}
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Visible route nodes currently promoted above the starfield.
              </div>
            </article>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Navigation band
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200">
                  Region {selectedSystem?.regionId ?? 'N/A'}
                </div>
                <div className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200">
                  Constellation {selectedSystem?.constellationId ?? 'N/A'}
                </div>
                {selectedConstellation ? (
                  <div className="rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1.5 text-xs text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
                    {selectedConstellation.name}
                  </div>
                ) : null}
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                当前焦点落在
                {selectedSystem
                  ? ` region ${selectedSystem.regionId} / constellation ${selectedSystem.constellationId}`
                  : ' 未选定区域'}
                ，用于补足地图上的空间认知层。
              </div>
            </article>
            <article className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Route spread
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3 dark:border-slate-800 dark:bg-slate-950/55">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Regions
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    {routeRegionCount}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3 dark:border-slate-800 dark:bg-slate-950/55">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Constellations
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    {routeConstellationCount}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200/70 bg-white/80 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
          <div className="rounded-[1.45rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
              <Crosshair className="h-3.5 w-3.5" />
              Focus Intel
            </div>
            <div className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {selectedSystem?.name ?? 'No system selected'}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {selectedSystem
                ? `System #${selectedSystem.id} is ${highlightedSet.has(selectedSystem.id) ? 'on' : 'outside'} the active route overlay.`
                : 'Use hover for preview and click for camera lock.'}
            </div>
            {detailedSelectedSystem ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/55">
                  X {formatCoordinate(detailedSelectedSystem.location.x)}k
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/55">
                  Y {formatCoordinate(detailedSelectedSystem.location.y)}k
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/55">
                  Z {formatCoordinate(detailedSelectedSystem.location.z)}k
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.45rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
              Route stack
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              将路径列表保留在独立侧栏，地图只负责空间定位和状态反馈，这一点直接借鉴了参考实现。
            </div>
            {route ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/85 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/55">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                      Active route
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                      {route.hops} hops
                    </div>
                  </div>
                  <div className="rounded-full border border-slate-200/80 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                    Explored {route.explored}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyRoute()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[1rem] border border-slate-200/80 bg-white/90 px-3 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950/55 dark:text-slate-300"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? 'Copied' : 'Copy route'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFocusedSystemId(route.path[route.path.length - 1]?.id ?? null)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[1rem] border border-slate-200/80 bg-white/90 px-3 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950/55 dark:text-slate-300"
                  >
                    <LocateFixed className="h-3.5 w-3.5" />
                    Focus end
                  </button>
                </div>
                <div className="max-h-[26rem] space-y-2 overflow-auto pr-1">
                  {route.path.map((system, index) => (
                    <button
                      key={system.id}
                      type="button"
                      onClick={() => setFocusedSystemId(system.id)}
                      className="block w-full rounded-[1.2rem] border border-slate-200/70 bg-white/90 p-3 text-left transition hover:border-sky-300 hover:bg-sky-50/60 dark:border-slate-800 dark:bg-slate-950/55 dark:hover:border-sky-700 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-950 dark:text-slate-100">
                            {system.name}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            #{system.id} · constellation {system.constellationId} · region{' '}
                            {system.regionId}
                          </div>
                        </div>
                        <div className="rounded-full border border-slate-200/80 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                          Stop {index + 1}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyPulseCard
                  title="Route standby"
                  body="Search two systems to project a route. Once calculated, every stop becomes clickable and the camera can jump directly to it."
                />
              </div>
            )}
          </div>

          <AtlasSystemDetails
            system={detailSystem}
            isLoading={isDetailLoading}
            error={detailError}
            onSelectSystemId={setFocusedSystemId}
            onSetOrigin={(system) => {
              setOrigin(system)
              setFocusedSystemId(system.id)
            }}
            onSetDestination={(system) => {
              setDestination(system)
              setFocusedSystemId(system.id)
            }}
          />
        </section>
      </div>
    </div>
  )
}
