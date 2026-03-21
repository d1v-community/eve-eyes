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
import { notification } from '~~/helpers/notification'
import { useTheme } from '../../providers/ThemeProvider'
import type {
  MapConstellation,
  MapLink,
  MapSystem,
  SearchSystem,
} from '../../world/types'
import AtlasSystemDetails from './AtlasSystemDetails'
import OverviewSpatialAtlas, {
  type AtlasTooltipAnchor,
} from './OverviewSpatialAtlas'
import SystemSearchInput from './SystemSearchInput'
import { useAtlasQueryState } from './useAtlasQueryState'
import { useAtlasSystemDetails } from './useAtlasSystemDetails'

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
    <article className="rounded-[1.45rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(248,245,238,0.62))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur dark:border-slate-700/70 dark:bg-[linear-gradient(180deg,rgba(6,12,22,0.92),rgba(10,18,32,0.86))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="font-display text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-amber-100/55">
        {label}
      </div>
      <div className="font-display mt-2 text-3xl font-semibold tracking-[-0.04em] text-stone-950 dark:text-stone-50">
        {value}
      </div>
    </article>
  )
}

export default function AtlasExplorer({
  systems,
  constellations,
  gateLinks,
}: AtlasExplorerProps) {
  const { resolvedTheme } = useTheme()
  const [hoveredSystem, setHoveredSystem] = useState<MapSystem | null>(null)
  const [hoveredAnchor, setHoveredAnchor] = useState<AtlasTooltipAnchor | null>(null)
  const [route, setRoute] = useState<RouteResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [routeFeedbackActive, setRouteFeedbackActive] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const nextIsDarkMode =
      resolvedTheme != null
        ? resolvedTheme === 'dark'
        : document.documentElement.classList.contains('dark')

    setIsDarkMode(nextIsDarkMode)
  }, [resolvedTheme])

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
  const {
    destination,
    focusedSystemId,
    origin,
    routeOnly,
    setDestination,
    setFocusedSystemId,
    setOrigin,
    setRouteOnly,
    setShowGateLinks,
    showGateLinks,
  } = useAtlasQueryState({
    allSystemsById,
    searchableSystemsById,
    initialOrigin: systems[0] ?? null,
    initialDestination: systems[1] ?? null,
  })
  const canSearch =
    origin != null && destination != null && origin.id !== destination.id

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

  const routeDensityLabel = route
    ? `${route.hops} hops across ${route.path.length} systems`
    : 'Route overlay inactive'
  const mapTooltipSystem = hoveredSystem
  const mapTooltipAnchor = hoveredAnchor
  const { detailError, detailSystem, isDetailLoading } =
    useAtlasSystemDetails(detailedSelectedSystem)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSearch) {
      setError('Choose two different solar systems to calculate a route.')
      notification.error(null, 'Choose two different solar systems to calculate a route.')
      return
    }

    setIsLoading(true)
    setError(null)
    const toastId = notification.loading('Plotting route...')

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
      setRouteFeedbackActive(true)
      window.setTimeout(() => setRouteFeedbackActive(false), 1600)
      notification.success('Route plotted successfully', toastId)
    } catch (requestError) {
      setRoute(null)
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Route search failed'
      setError(message)
      notification.error(
        requestError instanceof Error ? requestError : null,
        message,
        toastId
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
      `Route from ${route.path[0]?.name} to ${route.path[route.path.length - 1]?.name}\nHops: ${route.hops}\nExplored: ${route.explored}\n\n${content}`
    )
    notification.success('Route copied to clipboard')
  }

  return (
    <div className="relative overflow-hidden rounded-[2.2rem] border border-stone-300/70 bg-[linear-gradient(135deg,#f6efe2_0%,#efe4d3_38%,#d9e1e7_100%)] shadow-[0_32px_120px_rgba(40,32,20,0.14)] dark:border-slate-800/90 dark:bg-[linear-gradient(135deg,#030712_0%,#07111c_28%,#081a2b_62%,#0b1120_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.16),transparent_24%),radial-gradient(circle_at_70%_12%,rgba(15,118,110,0.10),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.12),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_24%),radial-gradient(circle_at_70%_12%,rgba(45,212,191,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_20%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-position:center] [background-size:28px_28px]" />

      <div className="relative grid gap-4 p-3 lg:p-4">
        <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <section className="flex flex-col gap-4 rounded-[1.9rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(252,248,241,0.94),rgba(242,235,223,0.88))] px-5 py-6 text-stone-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_20px_50px_rgba(96,74,40,0.14)] dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(6,12,22,0.96),rgba(8,16,28,0.94)_48%,rgba(7,15,24,0.98)_100%)] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_28px_70px_rgba(2,6,23,0.42)]">
            <div className="space-y-3">
              <div className="font-display inline-flex w-fit items-center gap-2 rounded-full border border-amber-400/50 bg-amber-100/60 px-3 py-1 text-[10px] uppercase tracking-[0.38em] text-amber-800 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                <Sparkles className="h-3.5 w-3.5" />
                Nav Console
              </div>
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-stone-950 dark:text-stone-50">
                  Atlas flight deck
                </h1>
                <p className="font-body mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300/88">
                  Search, swap, and issue route commands from a fixed dock while the map keeps center stage.
                </p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <SystemSearchInput
                label="Origin"
                placeholder="Search a starting solar system"
                selected={origin}
                tone={isDarkMode ? 'dark' : 'light'}
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
                className="font-body inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-stone-300/70 bg-white/80 px-4 py-2.5 text-sm font-medium text-stone-800 transition hover:border-amber-400 hover:bg-amber-50/70 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-stone-100 dark:hover:border-amber-300/40 dark:hover:bg-slate-900/90"
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
                className="font-body inline-flex items-center justify-center rounded-2xl border border-stone-300/70 bg-white/80 px-4 py-2.5 text-sm font-medium text-stone-800 transition hover:border-amber-400 hover:bg-amber-50/70 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-stone-100 dark:hover:border-amber-300/40 dark:hover:bg-slate-900/90"
                >
                  Reset
                </button>
              </div>
              <SystemSearchInput
                label="Destination"
                placeholder="Search a destination solar system"
                selected={destination}
                tone={isDarkMode ? 'dark' : 'light'}
                onSelect={(system) => {
                  setDestination(system)
                  setFocusedSystemId(system?.id ?? null)
                }}
              />
              <button
                type="submit"
                disabled={!canSearch || isLoading}
                className="font-display inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] bg-[linear-gradient(90deg,#fbbf24,#f59e0b)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200"
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

          <div className="rounded-[1.5rem] border border-stone-300/70 bg-white/60 p-4 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(4,10,18,0.96),rgba(8,16,28,0.92))]">
              <div className="font-display text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-amber-100/55">
                Command state
              </div>
              <div className="font-body mt-3 text-sm leading-6 text-stone-700 dark:text-stone-200">
                {routeDensityLabel}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFocusedSystemId(origin?.id ?? null)}
                  disabled={origin == null}
                  className="font-display inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-emerald-50/80 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-100 dark:hover:bg-emerald-300/15"
                >
                  <Target className="h-3.5 w-3.5" />
                  Origin
                </button>
                <button
                  type="button"
                  onClick={() => setFocusedSystemId(destination?.id ?? null)}
                  disabled={destination == null}
                  className="font-display inline-flex items-center gap-2 rounded-full border border-rose-300/50 bg-rose-50/80 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-300/25 dark:bg-rose-300/10 dark:text-rose-100 dark:hover:bg-rose-300/15"
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
                  className="font-display inline-flex items-center gap-2 rounded-full border border-cyan-300/50 bg-cyan-50/80 px-3 py-1.5 text-xs uppercase tracking-[0.24em] text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-200/25 dark:bg-cyan-200/10 dark:text-cyan-100 dark:hover:bg-cyan-200/15"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  Route start
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-[1.4rem] border border-red-300/60 bg-[linear-gradient(135deg,rgba(254,242,242,0.96),rgba(254,226,226,0.9))] px-4 py-3 text-sm text-red-800 shadow-[0_14px_32px_rgba(239,68,68,0.08)] dark:border-red-900/70 dark:bg-[linear-gradient(135deg,rgba(40,10,16,0.96),rgba(26,8,12,0.92))] dark:text-red-200">
                <div className="font-display text-[10px] uppercase tracking-[0.3em] text-red-700 dark:text-red-300">
                  Route status
                </div>
                <div className="font-body mt-2 leading-6">
                  {error}
                </div>
              </div>
            ) : null}
          </section>

        <section
          className={`min-w-0 rounded-[2rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(255,252,245,0.88),rgba(240,232,221,0.74))] p-3 shadow-[0_18px_50px_rgba(72,56,32,0.10)] backdrop-blur transition-all duration-500 dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(4,10,18,0.95),rgba(6,14,26,0.94))] ${
            routeFeedbackActive
              ? 'ring-2 ring-cyan-300/60 shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_24px_60px_rgba(34,211,238,0.16)] dark:ring-cyan-300/40 dark:shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_28px_72px_rgba(8,145,178,0.22)]'
              : ''
          }`}
        >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="rounded-[1.7rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,245,238,0.66))] p-4 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(8,16,28,0.92),rgba(10,20,36,0.88))]">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-display text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-slate-400">
                      Spatial Chamber
                    </div>
                    <div className="font-display mt-1 text-2xl font-semibold tracking-[-0.04em] text-stone-950 dark:text-white">
                      Real coordinates, cockpit-grade framing
                    </div>
                    <p className="font-body mt-2 max-w-2xl text-sm leading-6 text-stone-600 dark:text-slate-300">
                      The map remains central while controls and telemetry stay docked at the edges.
                    </p>
                  </div>
                  <div className="font-display inline-flex items-center gap-2 rounded-full border border-stone-300/70 bg-white/80 px-3 py-2 text-[10px] uppercase tracking-[0.34em] text-stone-600 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-300">
                    <Orbit className="h-3.5 w-3.5" />
                    Flight camera active
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGateLinks((value) => !value)}
                    className="font-display inline-flex items-center gap-2 rounded-full border border-stone-300/80 bg-white/85 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-stone-600 transition hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-300"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    {showGateLinks ? 'Hide links' : 'Show links'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRouteOnly((value) => !value)}
                    disabled={route == null}
                    className="font-display inline-flex items-center gap-2 rounded-full border border-stone-300/80 bg-white/85 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-stone-600 transition hover:border-amber-400 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-300"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {routeOnly ? 'Full map' : 'Route only'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetSignal((value) => value + 1)}
                    className="font-display inline-flex items-center gap-2 rounded-full border border-stone-300/80 bg-white/85 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-stone-600 transition hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-300"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    Reset view
                  </button>
                  {route != null ? (
                    <button
                      type="button"
                      onClick={() => void handleCopyRoute()}
                      className="font-display inline-flex items-center gap-2 rounded-full border border-cyan-300/50 bg-cyan-50/80 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-200/25 dark:bg-cyan-200/10 dark:text-cyan-100 dark:hover:bg-cyan-200/15"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy route
                    </button>
                  ) : null}
                </div>

                {route == null ? (
                  <div className="font-display mb-4 rounded-[1.1rem] border border-dashed border-stone-300/80 bg-white/60 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-stone-500 dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(3,8,16,0.96),rgba(8,16,28,0.92))] dark:text-slate-400">
                    Route-only focus unlocks after the first route is calculated.
                  </div>
                ) : null}

                <div className="relative overflow-hidden rounded-[1.65rem] border border-slate-200/70 dark:border-slate-800">
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
                    isDarkMode={isDarkMode}
                    onSelectSystemId={setFocusedSystemId}
                    onHoverSystem={(system, anchor) => {
                      setHoveredSystem(system)
                      setHoveredAnchor(anchor)
                    }}
                  />
                  {mapTooltipSystem && mapTooltipAnchor ? (
                    <div
                      className="pointer-events-none absolute z-10 max-w-[18rem] rounded-[1.15rem] border border-stone-300/80 bg-white/88 px-4 py-3 text-sm shadow-[0_14px_36px_rgba(72,56,32,0.16)] backdrop-blur transition-[left,top,transform] duration-75 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(2,8,16,0.98),rgba(7,15,27,0.95))] dark:shadow-[0_18px_44px_rgba(2,6,23,0.44)]"
                      style={{
                        left: `${mapTooltipAnchor.x}px`,
                        top: `${mapTooltipAnchor.y}px`,
                        transform:
                          mapTooltipAnchor.x > mapTooltipAnchor.width * 0.62
                            ? mapTooltipAnchor.y > mapTooltipAnchor.height * 0.72
                              ? 'translate(calc(-100% - 16px), calc(-100% - 16px))'
                              : 'translate(calc(-100% - 16px), -50%)'
                            : mapTooltipAnchor.y > mapTooltipAnchor.height * 0.72
                              ? 'translate(16px, calc(-100% - 16px))'
                              : 'translate(16px, -50%)',
                      }}
                    >
                      <div className="font-display text-[10px] uppercase tracking-[0.32em] text-stone-500 dark:text-slate-400">
                        Hovered node
                      </div>
                      <div className="font-display mt-2 text-base font-semibold tracking-[-0.03em] text-stone-950 dark:text-white">
                        {mapTooltipSystem.name}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-500 dark:text-slate-400">
                        <span className="font-data">
                          System #{mapTooltipSystem.id} · constellation {mapTooltipSystem.constellationId} · region {mapTooltipSystem.regionId}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2">
                        <div className="rounded-xl border border-stone-300/70 bg-stone-50/85 px-3 py-2 font-data text-stone-700 dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-200">
                          X {formatCoordinate(mapTooltipSystem.location.x)}k
                        </div>
                        <div className="rounded-xl border border-stone-300/70 bg-stone-50/85 px-3 py-2 font-data text-stone-700 dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-200">
                          Y {formatCoordinate(mapTooltipSystem.location.y)}k
                        </div>
                        <div className="rounded-xl border border-stone-300/70 bg-stone-50/85 px-3 py-2 font-data text-stone-700 dark:border-slate-800 dark:bg-slate-900/85 dark:text-slate-200">
                          Z {formatCoordinate(mapTooltipSystem.location.z)}k
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <aside className="grid gap-3">
                <article className="rounded-[1.45rem] border border-stone-300/70 bg-white/72 p-4 dark:border-slate-700/80 dark:bg-[rgba(8,16,28,0.9)]">
                  <div className="font-display text-[10px] uppercase tracking-[0.32em] text-stone-500 dark:text-slate-400">
                    Live focus
                  </div>
                  <div className="font-display mt-2 text-lg font-semibold tracking-[-0.03em] text-stone-950 dark:text-white">
                    {selectedSystem?.name ?? 'No system selected'}
                  </div>
                  <div className="font-body mt-2 text-sm leading-6 text-stone-600 dark:text-slate-300">
                    {selectedSystem
                      ? `Constellation ${selectedSystem.constellationId} · Region ${selectedSystem.regionId}`
                      : 'Hover or click any node to inspect the current sector.'}
                  </div>
                </article>

                <article className="rounded-[1.45rem] border border-stone-300/70 bg-white/72 p-4 dark:border-slate-700/80 dark:bg-[rgba(8,16,28,0.9)]">
                  <div className="font-display text-[10px] uppercase tracking-[0.32em] text-stone-500 dark:text-slate-400">
                    Route telemetry
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <div>
                      <div className="font-data text-2xl text-stone-950 dark:text-white">
                        {route?.hops ?? 0}
                      </div>
                      <div className="font-display text-[10px] uppercase tracking-[0.28em] text-stone-500 dark:text-slate-400">
                        Hops
                      </div>
                    </div>
                    <div>
                      <div className="font-data text-2xl text-stone-950 dark:text-white">
                        {route?.path.length ?? 0}
                      </div>
                      <div className="font-display text-[10px] uppercase tracking-[0.28em] text-stone-500 dark:text-slate-400">
                        Stops
                      </div>
                    </div>
                    <div>
                      <div className="font-data text-2xl text-stone-950 dark:text-white">
                        {route?.explored ?? 0}
                      </div>
                      <div className="font-display text-[10px] uppercase tracking-[0.28em] text-stone-500 dark:text-slate-400">
                        Explored
                      </div>
                    </div>
                  </div>
                </article>
              </aside>
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
          <section
            className={`rounded-[1.9rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(252,249,244,0.88),rgba(243,237,228,0.76))] p-4 shadow-[0_18px_50px_rgba(72,56,32,0.08)] backdrop-blur transition-all duration-500 dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(4,10,18,0.95),rgba(7,14,25,0.92))] ${
              routeFeedbackActive
                ? 'ring-2 ring-sky-300/55 shadow-[0_0_0_1px_rgba(56,189,248,0.22),0_24px_60px_rgba(56,189,248,0.14)] dark:ring-sky-300/35 dark:shadow-[0_0_0_1px_rgba(56,189,248,0.18),0_28px_72px_rgba(14,165,233,0.18)]'
                : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3 rounded-[1.4rem] border border-stone-300/70 bg-white/72 px-4 py-4 dark:border-slate-700/80 dark:bg-[rgba(8,16,28,0.9)]">
              <div>
                <div className="font-display text-[10px] uppercase tracking-[0.34em] text-stone-500 dark:text-slate-400">
                  Route stack
                </div>
                <div className="font-display mt-1 text-xl font-semibold tracking-[-0.03em] text-stone-950 dark:text-white">
                  {route ? `${route.hops} hops active` : 'Standby'}
                </div>
              </div>
              {route ? (
                <div className="font-data rounded-full border border-stone-300/80 bg-white/70 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-stone-500 dark:border-slate-700 dark:bg-slate-950/82 dark:text-slate-300">
                  Explored {route.explored}
                </div>
              ) : null}
            </div>

            {route ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyRoute()}
                    className="font-display inline-flex items-center gap-2 rounded-[1rem] border border-stone-300/80 bg-white/90 px-3 py-2 text-xs font-medium uppercase tracking-[0.24em] text-stone-600 transition hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-950/82 dark:text-slate-300"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy route
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFocusedSystemId(route.path[route.path.length - 1]?.id ?? null)
                    }
                    className="font-display inline-flex items-center gap-2 rounded-[1rem] border border-stone-300/80 bg-white/90 px-3 py-2 text-xs font-medium uppercase tracking-[0.24em] text-stone-600 transition hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-950/82 dark:text-slate-300"
                  >
                    <LocateFixed className="h-3.5 w-3.5" />
                    Focus end
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {route.path.map((system, index) => (
                    <button
                      key={system.id}
                      type="button"
                      onClick={() => setFocusedSystemId(system.id)}
                      className="block rounded-[1.2rem] border border-stone-300/70 bg-white/90 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50/40 dark:border-slate-700/80 dark:bg-slate-950/82 dark:hover:border-sky-700 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-display truncate font-medium tracking-[-0.02em] text-stone-950 dark:text-slate-100">
                            {system.name}
                          </div>
                          <div className="mt-1 text-xs text-stone-500 dark:text-slate-400">
                            <span className="font-data">
                              #{system.id} · constellation {system.constellationId} · region {system.regionId}
                            </span>
                          </div>
                        </div>
                        <div className="font-data rounded-full border border-stone-300/80 bg-stone-50/80 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-stone-500 dark:border-slate-700 dark:bg-slate-900/82 dark:text-slate-300">
                          {index + 1}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[1.35rem] border border-dashed border-stone-300/70 bg-white/70 px-4 py-8 text-center dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(3,8,16,0.97),rgba(8,16,28,0.94))]">
                <div className="font-display text-sm text-stone-900 dark:text-stone-100">
                  Route standby
                </div>
                <div className="font-body mt-2 text-sm leading-6 text-stone-600 dark:text-slate-300">
                  Search two systems to generate a route. Every stop will appear here as a clickable stack.
                </div>
              </div>
            )}
          </section>

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
        </div>
      </div>
    </div>
  )
}
