'use client'

import { Network, Orbit, Radar } from 'lucide-react'
import { useMemo, useState } from 'react'
import OverviewCorridorDeck from './OverviewCorridorDeck'
import OverviewNetworkGraph from './OverviewNetworkGraph'
import OverviewSpatialAtlas from './OverviewSpatialAtlas'

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

type OverviewMapLabProps = {
  systems: MapSystem[]
  constellations: MapConstellation[]
  gateLinks: MapLink[]
}

type ModeKey = 'spatial' | 'network' | 'corridor'

type PositionedSystem = MapSystem & {
  px: number
  py: number
}

const WIDTH = 880
const HEIGHT = 480
const PADDING = 56

const modeMeta: Record<
  ModeKey,
  {
    label: string
    title: string
    tech: string
    icon: typeof Orbit
    summary: string
    useCase: string
  }
> = {
  spatial: {
    label: 'Atlas',
    title: 'Spatial star atlas',
    tech: 'react-three-fiber + three.js',
    icon: Orbit,
    summary:
      'Use the real solar-system xyz coordinates to build a cinematic star map with camera fly-through, glow, and distance-preserving layout.',
    useCase:
      'Best for the primary atlas because your data is already spatial, not just relational.',
  },
  network: {
    label: 'Network',
    title: 'Gate topology explorer',
    tech: 'sigma.js or react-force-graph',
    icon: Network,
    summary:
      'Collapse the universe into a relationship-first graph so users can inspect hubs, chokepoints, and route branching without caring about physical distance.',
    useCase:
      'Best for route analysis, path debugging, and graph search tools where structure matters more than realism.',
  },
  corridor: {
    label: 'Corridor',
    title: 'Operational traffic layer',
    tech: 'deck.gl or custom GPU overlays',
    icon: Radar,
    summary:
      'Aggregate edges into constellation-level corridors and density beams to surface the routes and clusters that actually drive movement.',
    useCase:
      'Best for analytics overlays, faction influence, jump heat, and future player-intel layers.',
  },
}

function normalizeSystems(systems: MapSystem[]): PositionedSystem[] {
  if (systems.length === 0) return []

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const system of systems) {
    if (system.location.x < minX) minX = system.location.x
    if (system.location.x > maxX) maxX = system.location.x
    if (system.location.y < minY) minY = system.location.y
    if (system.location.y > maxY) maxY = system.location.y
  }

  const usableWidth = WIDTH - PADDING * 2
  const usableHeight = HEIGHT - PADDING * 2
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1

  return systems.map((system) => ({
    ...system,
    px: PADDING + ((system.location.x - minX) / rangeX) * usableWidth,
    py: HEIGHT - PADDING - ((system.location.y - minY) / rangeY) * usableHeight,
  }))
}

function buildConstellationAnchors(
  systems: PositionedSystem[],
  constellations: MapConstellation[]
) {
  const grouped = new Map<
    number,
    {
      x: number
      y: number
      count: number
    }
  >()

  for (const system of systems) {
    const current = grouped.get(system.constellationId) ?? { x: 0, y: 0, count: 0 }
    current.x += system.px
    current.y += system.py
    current.count += 1
    grouped.set(system.constellationId, current)
  }

  return constellations
    .map((constellation) => {
      const aggregate = grouped.get(constellation.id)
      if (aggregate == null || aggregate.count === 0) return null

      return {
        id: constellation.id,
        name: constellation.name,
        regionId: constellation.regionId,
        x: aggregate.x / aggregate.count,
        y: aggregate.y / aggregate.count,
        count: aggregate.count,
      }
    })
    .filter((value): value is NonNullable<typeof value> => value != null)
}

function buildGateEdges(systems: PositionedSystem[], gateLinks: MapLink[]) {
  const systemById = new Map(systems.map((system) => [system.id, system]))

  return gateLinks
    .map((link) => {
      const from = systemById.get(link.fromId)
      const to = systemById.get(link.toId)

      if (from == null || to == null) return null

      return {
        id: `${link.fromId}-${link.toId}`,
        from,
        to,
      }
    })
    .filter((value): value is NonNullable<typeof value> => value != null)
}

function buildCorridors(
  anchors: ReturnType<typeof buildConstellationAnchors>,
  gateLinks: MapLink[],
  systems: PositionedSystem[]
) {
  const systemById = new Map(systems.map((system) => [system.id, system]))
  const anchorById = new Map(anchors.map((anchor) => [anchor.id, anchor]))
  const grouped = new Map<string, { fromId: number; toId: number; weight: number }>()

  for (const link of gateLinks) {
    const fromSystem = systemById.get(link.fromId)
    if (fromSystem == null) continue

    const fromId = fromSystem.constellationId
    const toId = link.toConstellationId

    if (fromId === toId) continue

    const left = Math.min(fromId, toId)
    const right = Math.max(fromId, toId)
    const key = `${left}-${right}`
    const current = grouped.get(key) ?? { fromId: left, toId: right, weight: 0 }
    current.weight += 1
    grouped.set(key, current)
  }

  return [...grouped.values()]
    .map((corridor) => {
      const from = anchorById.get(corridor.fromId)
      const to = anchorById.get(corridor.toId)

      if (from == null || to == null) return null

      return { ...corridor, from, to }
    })
    .filter((value): value is NonNullable<typeof value> => value != null)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 10)
}

function tabClassName(active: boolean) {
  return [
    'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.24em] transition',
    active
      ? 'border-sky-400/70 bg-sky-500/15 text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.18)]'
      : 'border-white/10 bg-white/5 text-slate-400 hover:border-sky-500/40 hover:text-slate-100',
  ].join(' ')
}

export default function OverviewMapLab({
  systems,
  constellations,
  gateLinks,
}: OverviewMapLabProps) {
  const [mode, setMode] = useState<ModeKey>('spatial')
  const [hoveredSystem, setHoveredSystem] = useState<MapSystem | null>(null)
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(systems[0]?.id ?? null)
  const [networkQuery, setNetworkQuery] = useState('')
  const [hoveredCorridorKey, setHoveredCorridorKey] = useState<string | null>(null)
  const [selectedCorridorKey, setSelectedCorridorKey] = useState<string | null>(null)

  const positionedSystems = useMemo(() => normalizeSystems(systems), [systems])
  const anchors = useMemo(
    () => buildConstellationAnchors(positionedSystems, constellations),
    [positionedSystems, constellations]
  )
  const gateEdges = useMemo(
    () => buildGateEdges(positionedSystems, gateLinks),
    [positionedSystems, gateLinks]
  )
  const corridors = useMemo(
    () => buildCorridors(anchors, gateLinks, positionedSystems),
    [anchors, gateLinks, positionedSystems]
  )

  const activeMode = modeMeta[mode]
  const selectedSystem =
    systems.find((system) => system.id === selectedSystemId) ?? hoveredSystem ?? null
  const degreeMap = useMemo(() => {
    const next = new Map<number, number>()
    for (const link of gateLinks) {
      next.set(link.fromId, (next.get(link.fromId) ?? 0) + 1)
      next.set(link.toId, (next.get(link.toId) ?? 0) + 1)
    }
    return next
  }, [gateLinks])
  const topHubSystems = useMemo(
    () =>
      [...systems]
        .sort((left, right) => (degreeMap.get(right.id) ?? 0) - (degreeMap.get(left.id) ?? 0))
        .slice(0, 5),
    [degreeMap, systems]
  )
  const filteredNetworkSystems = useMemo(() => {
    const query = networkQuery.trim().toLowerCase()
    if (query.length < 2) return []
    return systems
      .filter((system) => system.name.toLowerCase().includes(query))
      .slice(0, 6)
  }, [networkQuery, systems])
  const selectedCorridor = useMemo(
    () =>
      corridors.find(
        (corridor) =>
          `${corridor.fromId}-${corridor.toId}` ===
          (hoveredCorridorKey ?? selectedCorridorKey)
      ) ?? null,
    [corridors, hoveredCorridorKey, selectedCorridorKey]
  )

  return (
    <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75 md:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-2">
          <div className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
            Overview Map Lab
          </div>
          <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
            Three map directions from the same universe dataset
          </h2>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            The current World API gives you real coordinates, constellation
            grouping, and gate links. That makes it possible to ship one
            cinematic atlas, one relationship view, and one operational overlay
            without inventing fake data models.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(modeMeta) as ModeKey[]).map((key) => {
            const Icon = modeMeta[key].icon

            return (
              <button
                key={key}
                type="button"
                className={tabClassName(mode === key)}
                onClick={() => setMode(key)}
              >
                <Icon className="h-4 w-4" />
                {modeMeta[key].label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-[linear-gradient(180deg,#020617,#0f172a_42%,#111827)] dark:border-slate-800">
          {mode === 'spatial' ? (
            <OverviewSpatialAtlas
              systems={systems}
              gateLinks={gateLinks.map((link) => ({
                fromId: link.fromId,
                toId: link.toId,
              }))}
              selectedSystemId={selectedSystemId}
              onSelectSystemId={setSelectedSystemId}
              onHoverSystem={setHoveredSystem}
            />
          ) : mode === 'network' ? (
            <OverviewNetworkGraph
              systems={systems}
              gateLinks={gateLinks.map((link) => ({
                fromId: link.fromId,
                toId: link.toId,
              }))}
              selectedSystemId={selectedSystemId}
              onSelectSystemId={setSelectedSystemId}
              onHoverSystem={setHoveredSystem}
            />
          ) : (
            <OverviewCorridorDeck
              systems={systems}
              constellations={constellations}
              gateLinks={gateLinks}
              selectedCorridorKey={selectedCorridorKey}
              onHoverCorridor={(corridor) => {
                setHoveredCorridorKey(
                  corridor != null ? `${corridor.fromId}-${corridor.toId}` : null
                )
              }}
              onSelectCorridor={(corridor) => {
                setSelectedCorridorKey(
                  corridor != null ? `${corridor.fromId}-${corridor.toId}` : null
                )
              }}
            />
          )}
        </div>

        <div className="grid gap-4">
          <article className="rounded-[1.75rem] border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-3 flex items-center gap-3">
              <activeMode.icon className="h-5 w-5 text-sky-600 dark:text-sky-300" />
              <div>
                <div className="text-lg font-medium text-slate-950 dark:text-white">
                  {activeMode.title}
                </div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  {activeMode.tech}
                </div>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              {activeMode.summary}
            </p>
            <p className="mt-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200">
              {activeMode.useCase}
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
            {(mode === 'spatial' || mode === 'network') && (hoveredSystem ?? selectedSystem) ? (
              <div className="mb-4 rounded-2xl border border-sky-200/70 bg-sky-50/80 p-4 text-sm leading-6 text-slate-700 dark:border-sky-900/70 dark:bg-sky-950/20 dark:text-slate-200">
                <div className="text-xs uppercase tracking-[0.24em] text-sky-700 dark:text-sky-300">
                  {hoveredSystem ? 'Hovered system' : 'Selected system'}
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                  {(hoveredSystem ?? selectedSystem)?.name}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  System #{(hoveredSystem ?? selectedSystem)?.id} · constellation{' '}
                  {(hoveredSystem ?? selectedSystem)?.constellationId} · region{' '}
                  {(hoveredSystem ?? selectedSystem)?.regionId}
                </div>
              </div>
            ) : null}
            {mode === 'corridor' && selectedCorridor ? (
              <div className="mb-4 rounded-2xl border border-fuchsia-200/70 bg-fuchsia-50/80 p-4 text-sm leading-6 text-slate-700 dark:border-fuchsia-900/70 dark:bg-fuchsia-950/20 dark:text-slate-200">
                <div className="text-xs uppercase tracking-[0.24em] text-fuchsia-700 dark:text-fuchsia-300">
                  Active corridor
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                  {selectedCorridor.from.name} to {selectedCorridor.to.name}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  {selectedCorridor.weight} aggregated gate links
                </div>
              </div>
            ) : null}

            {mode === 'network' ? (
              <div className="mb-4 space-y-4">
                <div>
                  <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Search system
                  </div>
                  <input
                    value={networkQuery}
                    onChange={(event) => setNetworkQuery(event.target.value)}
                    placeholder="Type 2+ chars"
                    className="w-full rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-white"
                  />
                  {filteredNetworkSystems.length > 0 ? (
                    <div className="mt-2 grid gap-2">
                      {filteredNetworkSystems.map((system) => (
                        <button
                          key={system.id}
                          type="button"
                          onClick={() => setSelectedSystemId(system.id)}
                          className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-left text-sm transition hover:border-sky-300 dark:border-slate-800 dark:bg-slate-950/50"
                        >
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {system.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            degree {degreeMap.get(system.id) ?? 0}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Top hubs
                  </div>
                  <div className="grid gap-2">
                    {topHubSystems.map((system, index) => (
                      <button
                        key={system.id}
                        type="button"
                        onClick={() => setSelectedSystemId(system.id)}
                        className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-left text-sm transition hover:border-sky-300 dark:border-slate-800 dark:bg-slate-950/50"
                      >
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {system.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            constellation {system.constellationId}
                          </div>
                        </div>
                        <div className="rounded-full border border-slate-200/80 px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                          #{index + 1} · {degreeMap.get(system.id) ?? 0}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {mode === 'corridor' ? (
              <div className="mb-4 space-y-3">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Top corridors
                </div>
                <div className="grid gap-2">
                  {corridors.slice(0, 5).map((corridor) => {
                    const corridorKey = `${corridor.fromId}-${corridor.toId}`

                    return (
                      <button
                        key={corridorKey}
                        type="button"
                        onClick={() => setSelectedCorridorKey(corridorKey)}
                        className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-left text-sm transition hover:border-fuchsia-300 dark:border-slate-800 dark:bg-slate-950/50"
                      >
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {corridor.from.name} to {corridor.to.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            regions {corridor.from.regionId} / {corridor.to.regionId}
                          </div>
                        </div>
                        <div className="rounded-full border border-slate-200/80 px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                          {corridor.weight}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Sample systems
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                  {positionedSystems.length}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Gate links
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                  {gateEdges.length}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Constellations
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                  {anchors.length}
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
