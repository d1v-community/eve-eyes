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
import { useRouter, useSearchParams } from 'next/navigation'
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
    <article className="rounded-[1.5rem] border border-amber-200/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.34em] text-amber-100/55">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-stone-50">{value}</div>
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
    <div className="rounded-[1.3rem] border border-dashed border-stone-300/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.7),rgba(255,255,255,0.5))] px-4 py-4 dark:border-stone-700 dark:bg-slate-950/30">
      <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
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
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [hasInitializedFromUrl, setHasInitializedFromUrl] = useState(false)

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
  const searchableSystemsById = useMemo(
    () =>
      new Map(
        systems.map((system) => [
          system.id,
          {
            id: system.id,
            name: system.name,
            constellationId: system.constellationId,
            regionId: system.regionId,
          },
        ])
      ),
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
    const originId = Number(searchParams.get('originId'))
    const destinationId = Number(searchParams.get('destinationId'))
    const focusId = Number(searchParams.get('focusId'))
    const nextShowLinks = searchParams.get('links')
    const nextView = searchParams.get('view')

    if (Number.isFinite(originId) && searchableSystemsById.has(originId)) {
      setOrigin(searchableSystemsById.get(originId) ?? null)
    }

    if (
      Number.isFinite(destinationId) &&
      searchableSystemsById.has(destinationId)
    ) {
      setDestination(searchableSystemsById.get(destinationId) ?? null)
    }

    if (Number.isFinite(focusId) && allSystemsById.has(focusId)) {
      setFocusedSystemId(focusId)
    }

    if (nextShowLinks != null) {
      setShowGateLinks(nextShowLinks !== '0')
    }

    if (nextView != null) {
      setRouteOnly(nextView === 'route')
    }

    setHasInitializedFromUrl(true)
  }, [allSystemsById, searchParams, searchableSystemsById])

  useEffect(() => {
    if (!hasInitializedFromUrl) return

    const params = new URLSearchParams(searchParams.toString())

    if (origin != null) {
      params.set('originId', String(origin.id))
    } else {
      params.delete('originId')
    }

    if (destination != null) {
      params.set('destinationId', String(destination.id))
    } else {
      params.delete('destinationId')
    }

    if (focusedSystemId != null) {
      params.set('focusId', String(focusedSystemId))
    } else {
      params.delete('focusId')
    }

    if (!showGateLinks) {
      params.set('links', '0')
    } else {
      params.delete('links')
    }

    if (routeOnly) {
      params.set('view', 'route')
    } else {
      params.delete('view')
    }

    const nextQuery = params.toString()
    const currentQuery = searchParams.toString()

    if (nextQuery === currentQuery) return

    router.replace(nextQuery.length > 0 ? `?${nextQuery}` : '/atlas', {
      scroll: false,
    })
  }, [
    destination,
    focusedSystemId,
    hasInitializedFromUrl,
    origin,
    routeOnly,
    router,
    searchParams,
    showGateLinks,
  ])

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
    const shareParams = new URLSearchParams()
    shareParams.set('originId', String(origin?.id ?? route.path[0]?.id ?? ''))
    shareParams.set(
      'destinationId',
      String(destination?.id ?? route.path[route.path.length - 1]?.id ?? '')
    )
    if (focusedSystemId != null) {
      shareParams.set('focusId', String(focusedSystemId))
    }
    if (!showGateLinks) {
      shareParams.set('links', '0')
    }
    if (routeOnly) {
      shareParams.set('view', 'route')
    }
    const shareUrl = `${window.location.origin}/atlas?${shareParams.toString()}`

    await navigator.clipboard.writeText(
      `Route from ${route.path[0]?.name} to ${route.path[route.path.length - 1]?.name}\nHops: ${route.hops}\n\n${content}\n\nShare: ${shareUrl}`
    )
    setCopied(true)
  }

  return (
    <div className="relative overflow-hidden rounded-[2.2rem] border border-stone-300/70 bg-[linear-gradient(135deg,#f6efe2_0%,#efe4d3_38%,#d9e1e7_100%)] shadow-[0_32px_120px_rgba(40,32,20,0.14)] dark:border-stone-800 dark:bg-[linear-gradient(135deg,#07111c_0%,#0b1c2d_42%,#111827_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.16),transparent_24%),radial-gradient(circle_at_70%_12%,rgba(15,118,110,0.10),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.12),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_24%),radial-gradient(circle_at_70%_12%,rgba(45,212,191,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-position:center] [background-size:28px_28px]" />

      <div className="relative grid gap-5 p-3 lg:p-4 xl:grid-cols-[22rem_minmax(0,1fr)_20rem]">
        <section className="flex flex-col gap-4 rounded-[1.9rem] border border-[#c58b3a]/30 bg-[linear-gradient(180deg,#102033_0%,#0b1725_68%,#09111a_100%)] px-5 py-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_50px_rgba(7,17,28,0.34)]">
          <div className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.38em] text-amber-100">
              <Sparkles className="h-3.5 w-3.5" />
              Nav Console
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-stone-50">
                Atlas flight deck
              </h1>
              <p className="mt-3 text-sm leading-7 text-stone-300/88">
                把路径规划、视角控制和节点情报压进同一套航图工作台，让地图成为主舞台，而不是背景插图。
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
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-stone-200/10 bg-stone-100/5 px-4 py-2.5 text-sm font-medium text-stone-100 transition hover:border-amber-300/40 hover:bg-stone-100/10"
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
                className="inline-flex items-center justify-center rounded-2xl border border-stone-200/10 bg-stone-100/5 px-4 py-2.5 text-sm font-medium text-stone-100 transition hover:border-amber-300/40 hover:bg-stone-100/10"
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] bg-[linear-gradient(90deg,#fbbf24,#f59e0b)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200"
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

          <div className="rounded-[1.5rem] border border-stone-200/10 bg-black/12 p-4">
            <div className="text-[10px] uppercase tracking-[0.34em] text-amber-100/55">
              Command state
            </div>
            <div className="mt-3 text-sm leading-6 text-stone-200">
              {routeDensityLabel}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFocusedSystemId(origin?.id ?? null)}
                disabled={origin == null}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Target className="h-3.5 w-3.5" />
                Origin
              </button>
              <button
                type="button"
                onClick={() => setFocusedSystemId(destination?.id ?? null)}
                disabled={destination == null}
                className="inline-flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-300/10 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-cyan-100 transition hover:bg-cyan-200/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Crosshair className="h-3.5 w-3.5" />
                Route start
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-[1.4rem] border border-red-400/30 bg-red-500/12 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}
        </section>

        <section className="min-w-0 rounded-[2rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(255,252,245,0.88),rgba(240,232,221,0.74))] p-3 shadow-[0_18px_50px_rgba(72,56,32,0.10)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/55">
          <div className="mb-3 flex flex-col gap-3 rounded-[1.6rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,245,238,0.66))] px-4 py-4 dark:border-slate-800 dark:bg-slate-950/55 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-slate-400">
                Spatial Chamber
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-stone-950 dark:text-white">
                Real coordinates, cockpit-grade framing
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-300/70 bg-white/80 px-3 py-2 text-[10px] uppercase tracking-[0.34em] text-stone-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              <Orbit className="h-3.5 w-3.5" />
              Flight camera active
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowGateLinks((value) => !value)}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300/80 bg-white/85 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-stone-600 transition hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
            >
              <GitBranch className="h-3.5 w-3.5" />
              {showGateLinks ? 'Hide links' : 'Show links'}
            </button>
            <button
              type="button"
              onClick={() => setRouteOnly((value) => !value)}
              disabled={route == null}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300/80 bg-white/85 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-stone-600 transition hover:border-amber-400 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
            >
              <Eye className="h-3.5 w-3.5" />
              {routeOnly ? 'Full map' : 'Route only'}
            </button>
            <button
              type="button"
              onClick={() => setResetSignal((value) => value + 1)}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300/80 bg-white/85 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-stone-600 transition hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
            >
              <Crosshair className="h-3.5 w-3.5" />
              Reset view
            </button>
          </div>

          {route == null ? (
            <div className="mb-3 rounded-[1.1rem] border border-dashed border-stone-300/80 bg-white/60 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-stone-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
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
            <article className="rounded-[1.45rem] border border-stone-300/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-slate-400">
                Focus target
              </div>
              <div className="mt-2 text-lg font-semibold text-stone-950 dark:text-white">
                {selectedSystem?.name ?? 'No system selected'}
              </div>
              <div className="mt-1 text-sm text-stone-600 dark:text-slate-300">
                {selectedSystem
                  ? `Constellation ${selectedSystem.constellationId} · Region ${selectedSystem.regionId}`
                  : 'Hover or click any node to inspect the sector.'}
              </div>
            </article>
            <article className="rounded-[1.45rem] border border-stone-300/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-slate-400">
                Linked edges
              </div>
              <div className="mt-2 text-lg font-semibold text-stone-950 dark:text-white">
                {selectedGateLinkCount}
              </div>
              <div className="mt-1 text-sm text-stone-600 dark:text-slate-300">
                Gate structure touching the current focus node.
              </div>
            </article>
            <article className="rounded-[1.45rem] border border-stone-300/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-slate-400">
                Path coverage
              </div>
              <div className="mt-2 text-lg font-semibold text-stone-950 dark:text-white">
                {route ? route.path.length : 0}
              </div>
              <div className="mt-1 text-sm text-stone-600 dark:text-slate-300">
                Visible route nodes currently promoted above the starfield.
              </div>
            </article>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-[1.45rem] border border-stone-300/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-slate-400">
                Navigation band
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="rounded-full border border-stone-300/80 bg-stone-50/80 px-3 py-1.5 text-xs text-stone-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200">
                  Region {selectedSystem?.regionId ?? 'N/A'}
                </div>
                <div className="rounded-full border border-stone-300/80 bg-stone-50/80 px-3 py-1.5 text-xs text-stone-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200">
                  Constellation {selectedSystem?.constellationId ?? 'N/A'}
                </div>
                {selectedConstellation ? (
                  <div className="rounded-full border border-amber-300/60 bg-amber-50/80 px-3 py-1.5 text-xs text-amber-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200">
                    {selectedConstellation.name}
                  </div>
                ) : null}
              </div>
              <div className="mt-3 text-sm leading-6 text-stone-600 dark:text-slate-300">
                当前焦点落在
                {selectedSystem
                  ? ` region ${selectedSystem.regionId} / constellation ${selectedSystem.constellationId}`
                  : ' 未选定区域'}
                ，用于补足地图上的空间认知层。
              </div>
            </article>
            <article className="rounded-[1.45rem] border border-stone-300/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-slate-400">
                Route spread
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-stone-300/70 bg-stone-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/55">
                  <div className="text-xs uppercase tracking-[0.2em] text-stone-400">
                    Regions
                  </div>
                  <div className="mt-1 text-lg font-semibold text-stone-950 dark:text-white">
                    {routeRegionCount}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-300/70 bg-stone-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/55">
                  <div className="text-xs uppercase tracking-[0.2em] text-stone-400">
                    Constellations
                  </div>
                  <div className="mt-1 text-lg font-semibold text-stone-950 dark:text-white">
                    {routeConstellationCount}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-[1.9rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(252,249,244,0.86),rgba(243,237,228,0.74))] p-4 shadow-[0_18px_50px_rgba(72,56,32,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
          <div className="rounded-[1.55rem] border border-stone-300/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-stone-300/80 bg-stone-50/70 px-3 py-1 text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:border-slate-700 dark:text-slate-300">
              <Crosshair className="h-3.5 w-3.5" />
              Focus Intel
            </div>
            <div className="text-2xl font-semibold tracking-tight text-stone-950 dark:text-white">
              {selectedSystem?.name ?? 'No system selected'}
            </div>
            <div className="mt-2 text-sm leading-6 text-stone-600 dark:text-slate-300">
              {selectedSystem
                ? `System #${selectedSystem.id} is ${highlightedSet.has(selectedSystem.id) ? 'on' : 'outside'} the active route overlay.`
                : 'Use hover for preview and click for camera lock.'}
            </div>
            {detailedSelectedSystem ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-stone-300/70 bg-stone-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/55">
                  X {formatCoordinate(detailedSelectedSystem.location.x)}k
                </div>
                <div className="rounded-2xl border border-stone-300/70 bg-stone-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/55">
                  Y {formatCoordinate(detailedSelectedSystem.location.y)}k
                </div>
                <div className="rounded-2xl border border-stone-300/70 bg-stone-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/55">
                  Z {formatCoordinate(detailedSelectedSystem.location.z)}k
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.55rem] border border-stone-300/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-slate-400">
              Route stack
            </div>
            <div className="mt-2 text-sm leading-6 text-stone-600 dark:text-slate-300">
              路径层保留在右侧轨迹堆栈，地图负责空间感与对焦，侧栏负责决策与下一步动作。
            </div>
            {route ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-300/70 bg-stone-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/55">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-slate-400">
                      Active route
                    </div>
                    <div className="mt-1 text-lg font-semibold text-stone-950 dark:text-white">
                      {route.hops} hops
                    </div>
                  </div>
                  <div className="rounded-full border border-stone-300/80 bg-white/70 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-stone-500 dark:border-slate-700 dark:text-slate-300">
                    Explored {route.explored}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyRoute()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[1rem] border border-stone-300/80 bg-white/90 px-3 py-2 text-xs font-medium uppercase tracking-[0.24em] text-stone-600 transition hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-950/55 dark:text-slate-300"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? 'Copied' : 'Copy route'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFocusedSystemId(route.path[route.path.length - 1]?.id ?? null)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[1rem] border border-stone-300/80 bg-white/90 px-3 py-2 text-xs font-medium uppercase tracking-[0.24em] text-stone-600 transition hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-950/55 dark:text-slate-300"
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
                      className="block w-full rounded-[1.2rem] border border-stone-300/70 bg-white/90 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50/40 dark:border-slate-800 dark:bg-slate-950/55 dark:hover:border-sky-700 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-stone-950 dark:text-slate-100">
                            {system.name}
                          </div>
                          <div className="mt-1 text-xs text-stone-500 dark:text-slate-400">
                            #{system.id} · constellation {system.constellationId} · region{' '}
                            {system.regionId}
                          </div>
                        </div>
                        <div className="rounded-full border border-stone-300/80 bg-stone-50/80 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-stone-500 dark:border-slate-700 dark:text-slate-300">
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
