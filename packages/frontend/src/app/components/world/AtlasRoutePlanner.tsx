'use client'

import { ArrowRightLeft, Check, Copy, Loader2, Route, Shuffle } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'
import AtlasRecentRoutes from './AtlasRecentRoutes'
import AtlasRouteMap from './AtlasRouteMap'
import AtlasSystemDetails from './AtlasSystemDetails'
import SystemSearchInput from './SystemSearchInput'

type SystemSearchResult = {
  id: number
  name: string
  constellationId: number
  regionId: number
}

type RouteNode = SystemSearchResult

type RouteResponse = {
  path: RouteNode[]
  hops: number
  explored: number
}

type RouteHistoryItem = {
  origin: {
    id: number
    name: string
  }
  destination: {
    id: number
    name: string
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

const STORAGE_KEY = 'eve-eyes-atlas-recent-routes'

export default function AtlasRoutePlanner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [origin, setOrigin] = useState<SystemSearchResult | null>(null)
  const [destination, setDestination] = useState<SystemSearchResult | null>(null)
  const [route, setRoute] = useState<RouteResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [recentRoutes, setRecentRoutes] = useState<RouteHistoryItem[]>([])
  const [copied, setCopied] = useState(false)
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null)
  const [selectedSystem, setSelectedSystem] = useState<DetailedSolarSystem | null>(
    null
  )
  const [isNodeLoading, setIsNodeLoading] = useState(false)
  const [nodeError, setNodeError] = useState<string | null>(null)
  const originParam = searchParams.get('originId')
  const destinationParam = searchParams.get('destinationId')
  const deferredOrigin = useDeferredValue(originParam)
  const deferredDestination = useDeferredValue(destinationParam)

  const canSearch =
    origin != null && destination != null && origin.id !== destination.id

  const shareQuery = useMemo(() => {
    if (origin == null || destination == null) {
      return pathname
    }

    return `${pathname}?originId=${origin.id}&destinationId=${destination.id}`
  }, [destination, origin, pathname])

  useEffect(() => {
    const storedValue = window.localStorage.getItem(STORAGE_KEY)

    if (!storedValue) {
      return
    }

    try {
      setRecentRoutes(JSON.parse(storedValue) as RouteHistoryItem[])
    } catch {
      setRecentRoutes([])
    }
  }, [])

  useEffect(() => {
    if (!deferredOrigin || !deferredDestination) {
      return
    }

    const loadRoute = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/world/route?originId=${deferredOrigin}&destinationId=${deferredDestination}`
        )
        const payload = (await response.json()) as RouteResponse & {
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error ?? 'Route search failed')
        }

        setRoute(payload)
        setSelectedSystemId(payload.path[0]?.id ?? null)

        const first = payload.path[0]
        const last = payload.path[payload.path.length - 1]

        if (first && last) {
          const historyItem = {
            origin: { id: first.id, name: first.name },
            destination: { id: last.id, name: last.name },
          }

          setOrigin(first)
          setDestination(last)
          setRecentRoutes((previous) => {
            const next = [
              historyItem,
              ...previous.filter(
                (item) =>
                  !(
                    item.origin.id === historyItem.origin.id &&
                    item.destination.id === historyItem.destination.id
                  )
              ),
            ].slice(0, 6)

            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
            return next
          })
        }
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

    void loadRoute()
  }, [deferredDestination, deferredOrigin])

  useEffect(() => {
    if (selectedSystemId == null) {
      setSelectedSystem(null)
      setNodeError(null)
      return
    }

    const controller = new AbortController()

    const loadSystem = async () => {
      setIsNodeLoading(true)
      setNodeError(null)

      try {
        const response = await fetch(`/api/world/systems/${selectedSystemId}`, {
          signal: controller.signal,
        })
        const payload = (await response.json()) as DetailedSolarSystem & {
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to load system details')
        }

        setSelectedSystem(payload)
      } catch (requestError) {
        if ((requestError as Error).name === 'AbortError') {
          return
        }

        setSelectedSystem(null)
        setNodeError(
          requestError instanceof Error
            ? requestError.message
            : 'Failed to load system details'
        )
      } finally {
        setIsNodeLoading(false)
      }
    }

    void loadSystem()

    return () => controller.abort()
  }, [selectedSystemId])

  const pushSelection = (nextOrigin: SystemSearchResult | null, nextDestination: SystemSearchResult | null) => {
    const params = new URLSearchParams(searchParams.toString())

    if (nextOrigin != null) {
      params.set('originId', String(nextOrigin.id))
    } else {
      params.delete('originId')
    }

    if (nextDestination != null) {
      params.set('destinationId', String(nextDestination.id))
    } else {
      params.delete('destinationId')
    }

    const nextPath = params.toString() ? `${pathname}?${params}` : pathname
    router.replace(nextPath, { scroll: false })
  }

  const handleSwap = () => {
    startTransition(() => {
      const nextOrigin = destination
      const nextDestination = origin

      setOrigin(nextOrigin)
      setDestination(nextDestination)
      setRoute(null)
      setSelectedSystem(null)
      setSelectedSystemId(null)
      setError(null)
      pushSelection(nextOrigin, nextDestination)
    })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSearch) {
      setError('Choose two different solar systems to calculate a route.')
      return
    }

    setRoute(null)
    setSelectedSystem(null)
    setSelectedSystemId(null)
    setError(null)
    pushSelection(origin, destination)
  }

  const handleCopyRoute = async () => {
    if (!route) {
      return
    }

    const routeText = route.path
      .map((system, index) => `${index + 1}. ${system.name} (#${system.id})`)
      .join('\n')

    await navigator.clipboard.writeText(
      `Route from ${route.path[0]?.name} to ${route.path[route.path.length - 1]?.name}\nHops: ${route.hops}\n\n${routeText}\n\nShare: ${window.location.origin}${shareQuery}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
        <div className="mb-6 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/80 dark:bg-sky-950/40 dark:text-sky-200">
            <Route className="h-3.5 w-3.5" />
            Route Planner
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Search origin and destination, then compute a real gate path.
          </h1>
          <p className="max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            Search stays lightweight in the browser. Name lookup and graph
            traversal run on the server, so the UI remains fast and mobile-safe
            even when the universe is large.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <SystemSearchInput
            label="Origin"
            placeholder="Search a starting solar system"
            selected={origin}
            onSelect={setOrigin}
          />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200"
            >
              <Shuffle className="h-4 w-4" />
              Swap systems
            </button>
          </div>
          <SystemSearchInput
            label="Destination"
            placeholder="Search a destination solar system"
            selected={destination}
            onSelect={setDestination}
          />
          <button
            type="submit"
            disabled={!canSearch || isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-4 w-4" />
            )}
            {isLoading ? 'Calculating route...' : 'Find best path'}
          </button>
        </form>

        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          The route engine uses cached gate-link expansion on demand. First
          searches may be slower, but follow-up searches reuse previously loaded
          systems.
        </div>

        <div className="mt-4">
          <AtlasRecentRoutes
            items={recentRoutes}
            onSelect={(item) => {
              const nextOrigin = {
                id: item.origin.id,
                name: item.origin.name,
                constellationId: 0,
                regionId: 0,
              }
              const nextDestination = {
                id: item.destination.id,
                name: item.destination.name,
                constellationId: 0,
                regionId: 0,
              }

              setOrigin(nextOrigin)
              setDestination(nextDestination)
              setRoute(null)
              setSelectedSystem(null)
              setSelectedSystemId(null)
              setError(null)
              pushSelection(nextOrigin, nextDestination)
            }}
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
              Route Output
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              {route
                ? `${route.hops} hops across ${route.path.length} systems`
                : 'No route yet'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {route ? (
              <button
                type="button"
                onClick={() => void handleCopyRoute()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy route'}
              </button>
            ) : null}
            {route ? (
              <div className="rounded-full border border-slate-200/80 px-3 py-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                Explored {route.explored} nodes
              </div>
            ) : null}
          </div>
        </div>

        {origin && destination ? (
          <div className="mb-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            Shareable query: <span className="font-medium">{shareQuery}</span>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {route ? (
          <div className="space-y-4">
            <AtlasRouteMap
              path={route.path}
              selectedSystemId={selectedSystemId}
              onSelect={(system) => setSelectedSystemId(system.id)}
            />
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3">
                {route.path.map((system, index) => (
                  <button
                    key={system.id}
                    type="button"
                    onClick={() => setSelectedSystemId(system.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedSystemId === system.id
                        ? 'border-sky-300 bg-sky-50/80 dark:border-sky-700 dark:bg-sky-950/30'
                        : 'border-slate-200/70 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-lg font-medium text-slate-900 dark:text-slate-100">
                          {system.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          #{system.id} · constellation {system.constellationId} ·
                          region {system.regionId}
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                        Stop {index + 1}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <AtlasSystemDetails
                system={selectedSystem}
                isLoading={isNodeLoading}
                error={nodeError}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Pick two systems and the page will render the gate-by-gate route
            here, including hop count and search effort.
          </div>
        )}
      </section>
    </div>
  )
}
