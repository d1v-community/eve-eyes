'use client'

import { Network, Orbit, Radar, Sparkles, Telescope } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useMemo, useState } from 'react'
import { projectSpatialSystemsToViewport } from '../../world/spatial-layout'
import type { MapConstellation, MapLink, MapSystem } from '../../world/types'
import OverviewCorridorDeck from './OverviewCorridorDeck'
import OverviewNetworkGraph from './OverviewNetworkGraph'
import OverviewSpatialAtlas from './OverviewSpatialAtlas'

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

type Corridor = {
  fromId: number
  toId: number
  weight: number
  from: {
    id: number
    name: string
    regionId: number
    x: number
    y: number
    count: number
  }
  to: {
    id: number
    name: string
    regionId: number
    x: number
    y: number
    count: number
  }
}

const WIDTH = 880
const HEIGHT = 480
const PADDING = 56

const modeMeta: Record<
  ModeKey,
  {
    label: string
    title: string
    stance: string
    icon: typeof Orbit
    summary: string
    instruction: string
  }
> = {
  spatial: {
    label: 'Atlas',
    title: 'Spatial star atlas',
    stance: 'Read the universe as volume, distance, and clustering.',
    icon: Orbit,
    summary:
      'Real xyz coordinates turn the map into a physical field instead of a symbolic diagram.',
    instruction:
      'Orbit the camera, zoom through depth, and lock onto systems to understand spatial context before route logic takes over.',
  },
  network: {
    label: 'Network',
    title: 'Gate topology explorer',
    stance: 'Ignore distance and expose pure structure.',
    icon: Network,
    summary:
      'Hubs, branching, and chokepoints become legible once physical placement is collapsed into connectivity.',
    instruction:
      'Search by system name or jump directly to hub systems to inspect graph gravity, not geography.',
  },
  corridor: {
    label: 'Corridor',
    title: 'Operational traffic layer',
    stance: 'Aggregate movement into lanes that matter operationally.',
    icon: Radar,
    summary:
      'Constellation bridges reveal where route pressure concentrates instead of where points merely exist.',
    instruction:
      'Select a corridor to inspect its weight, regional span, and the strongest route bridges in the sampled map.',
  },
}

function normalizeSystems(systems: MapSystem[]): PositionedSystem[] {
  return projectSpatialSystemsToViewport(systems, {
    width: WIDTH,
    height: HEIGHT,
    padding: PADDING,
  })
}

function buildConstellationAnchors(
  systems: PositionedSystem[],
  constellations: MapConstellation[]
) {
  const grouped = new Map<number, { x: number; y: number; count: number }>()

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
    .filter((value): value is Corridor => value != null)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 10)
}

function tabClassName(active: boolean) {
  return [
    'font-display group inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] transition',
    active
      ? 'border-sky-300 bg-sky-50 text-sky-700 shadow-[0_10px_28px_rgba(56,189,248,0.14)] dark:border-sky-400/70 dark:bg-sky-500/15 dark:text-sky-100 dark:shadow-[0_0_24px_rgba(56,189,248,0.18)]'
      : 'border-slate-200/80 bg-white/80 text-slate-500 hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-sky-500/40 dark:hover:text-slate-100',
  ].join(' ')
}

export default function OverviewMapLab({
  systems,
  constellations,
  gateLinks,
}: OverviewMapLabProps) {
  const { resolvedTheme } = useTheme()
  const [mode, setMode] = useState<ModeKey>('spatial')
  const [hoveredSystem, setHoveredSystem] = useState<MapSystem | null>(null)
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(systems[0]?.id ?? null)
  const [networkQuery, setNetworkQuery] = useState('')
  const [hoveredCorridorKey, setHoveredCorridorKey] = useState<string | null>(null)
  const [selectedCorridorKey, setSelectedCorridorKey] = useState<string | null>(null)
  const isDarkMode = resolvedTheme !== 'light'
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
  const averageDegree = useMemo(() => {
    if (systems.length === 0) return 0
    return Math.round((gateLinks.length * 2) / systems.length)
  }, [gateLinks.length, systems.length])
  const densestCorridor = corridors[0] ?? null

  const activeSignals = useMemo(() => {
    if (mode === 'spatial') {
      return [
        {
          label: 'Mapped systems',
          value: positionedSystems.length.toLocaleString('en-US'),
          note: 'Physical points in the sampled atlas.',
        },
        {
          label: 'Gate segments',
          value: gateEdges.length.toLocaleString('en-US'),
          note: 'Visible links threading the field.',
        },
        {
          label: 'Anchor constellations',
          value: anchors.length.toLocaleString('en-US'),
          note: 'Cluster centers extracted from geometry.',
        },
      ]
    }

    if (mode === 'network') {
      return [
        {
          label: 'Average degree',
          value: averageDegree.toLocaleString('en-US'),
          note: 'Mean gate connectivity in the current sample.',
        },
        {
          label: 'Top hub',
          value: topHubSystems[0]?.name ?? 'Unavailable',
          note: topHubSystems[0]
            ? `${degreeMap.get(topHubSystems[0].id) ?? 0} visible links`
            : 'No hub signal yet.',
        },
        {
          label: 'Search hits',
          value: filteredNetworkSystems.length.toLocaleString('en-US'),
          note:
            networkQuery.trim().length >= 2
              ? 'Matching systems in the current query.'
              : 'Type at least two characters to search.',
        },
      ]
    }

    return [
      {
        label: 'Corridor set',
        value: corridors.length.toLocaleString('en-US'),
        note: 'Ranked constellation bridges in the sample.',
      },
      {
        label: 'Strongest lane',
        value: densestCorridor
          ? `${densestCorridor.from.name} / ${densestCorridor.to.name}`
          : 'Unavailable',
        note: densestCorridor
          ? `${densestCorridor.weight} aggregated links`
          : 'No corridor signal yet.',
      },
      {
        label: 'Regional spread',
        value: densestCorridor
          ? `${densestCorridor.from.regionId} / ${densestCorridor.to.regionId}`
          : '--',
        note: 'Regions touched by the leading corridor.',
      },
    ]
  }, [
    anchors.length,
    averageDegree,
    corridors.length,
    degreeMap,
    densestCorridor,
    filteredNetworkSystems.length,
    gateEdges.length,
    mode,
    networkQuery,
    positionedSystems.length,
    topHubSystems,
  ])

  return (
    <section className="overflow-hidden rounded-[2.1rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(15,23,42,0.84))] md:p-6">
      <div className="grid gap-5 xl:grid-cols-[1.22fr_0.78fr]">
        <div className="rounded-[1.8rem] border border-slate-200/80 bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-slate-800 dark:bg-slate-950/45">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
              <Telescope className="h-3.5 w-3.5" />
              Cartography lab
            </span>
            <span className="font-body inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              <Sparkles className="h-3.5 w-3.5" />
              Same universe, three lenses
            </span>
          </div>

          <div className="mt-5 max-w-3xl">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.045em] text-slate-950 dark:text-white md:text-[2.6rem]">
              Atlas for scale.
              <br />
              Network for structure.
              <br />
              Corridor for movement.
            </h2>
            <p className="font-body mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base">
              The same solar-system dataset can be read as geometry, topology,
              or traffic. Switching modes should change the question you can ask,
              not just the skin on the canvas.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {(Object.keys(modeMeta) as ModeKey[]).map((key) => {
              const Icon = modeMeta[key].icon

              return (
                <button
                  key={key}
                  type="button"
                  className={tabClassName(mode === key)}
                  onClick={() => setMode(key)}
                >
                  <Icon className="h-4 w-4 transition group-hover:scale-110" />
                  {modeMeta[key].label}
                </button>
              )
            })}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {activeSignals.map((signal) => (
              <article
                key={signal.label}
                className="rounded-[1.25rem] border border-slate-200/80 bg-white/82 px-4 py-4 transition hover:-translate-y-0.5 hover:border-sky-300 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-sky-800"
              >
                <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  {signal.label}
                </div>
                <div className="font-display mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {signal.value}
                </div>
                <div className="font-body mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {signal.note}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <article className="rounded-[1.8rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(240,249,255,0.86))] p-5 transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_18px_40px_rgba(56,189,248,0.1)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.82),rgba(15,23,42,0.74))] dark:hover:border-sky-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Active lens
                </div>
                <div className="font-display mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {activeMode.title}
                </div>
              </div>
              <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 p-3 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300">
                <activeMode.icon className="h-5 w-5" />
              </div>
            </div>

            <div className="font-body mt-4 text-sm leading-7 text-slate-700 dark:text-slate-200">
              {activeMode.stance}
            </div>
            <div className="font-body mt-4 rounded-[1.2rem] border border-slate-200/80 bg-white/82 px-4 py-4 text-sm leading-7 text-slate-700 dark:border-slate-800 dark:bg-slate-950/55 dark:text-slate-200">
              {activeMode.summary}
            </div>
            <div className="font-body mt-3 rounded-[1.2rem] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:bg-slate-900/55 dark:text-slate-300">
              {activeMode.instruction}
            </div>
          </article>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_32%),linear-gradient(180deg,#f8fbff,#eef6ff_42%,#e2e8f0)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,#020617,#0f172a_42%,#111827)]">
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
              isDarkMode={isDarkMode}
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
            {(mode === 'spatial' || mode === 'network') && (hoveredSystem ?? selectedSystem) ? (
              <div className="font-body mb-4 rounded-2xl border border-sky-200/70 bg-sky-50/80 p-4 text-sm leading-6 text-slate-700 dark:border-sky-900/70 dark:bg-sky-950/20 dark:text-slate-200">
                <div className="font-display text-xs uppercase tracking-[0.24em] text-sky-700 dark:text-sky-300">
                  {hoveredSystem ? 'Hovered system' : 'Selected system'}
                </div>
                <div className="font-display mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                  {(hoveredSystem ?? selectedSystem)?.name}
                </div>
                <div className="font-data mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  System #{(hoveredSystem ?? selectedSystem)?.id} · constellation{' '}
                  {(hoveredSystem ?? selectedSystem)?.constellationId} · region{' '}
                  {(hoveredSystem ?? selectedSystem)?.regionId}
                </div>
              </div>
            ) : null}
            {mode === 'corridor' && selectedCorridor ? (
              <div className="font-body mb-4 rounded-2xl border border-fuchsia-200/70 bg-fuchsia-50/80 p-4 text-sm leading-6 text-slate-700 dark:border-fuchsia-900/70 dark:bg-fuchsia-950/20 dark:text-slate-200">
                <div className="font-display text-xs uppercase tracking-[0.24em] text-fuchsia-700 dark:text-fuchsia-300">
                  Active corridor
                </div>
                <div className="font-display mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                  {selectedCorridor.from.name} to {selectedCorridor.to.name}
                </div>
                <div className="font-data mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  {selectedCorridor.weight} aggregated gate links
                </div>
              </div>
            ) : null}

            {mode === 'network' ? (
              <div className="mb-4 space-y-4">
                <div>
                  <div className="font-display mb-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Search system
                  </div>
                  <input
                    value={networkQuery}
                    onChange={(event) => setNetworkQuery(event.target.value)}
                    placeholder="Type 2+ chars"
                    className="font-body w-full rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-white"
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
                          <div className="font-display font-medium tracking-[-0.02em] text-slate-900 dark:text-slate-100">
                            {system.name}
                          </div>
                          <div className="font-data text-xs text-slate-500 dark:text-slate-400">
                            degree {degreeMap.get(system.id) ?? 0}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="font-display mb-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
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
                          <div className="font-display font-medium tracking-[-0.02em] text-slate-900 dark:text-slate-100">
                            {system.name}
                          </div>
                          <div className="font-data text-xs text-slate-500 dark:text-slate-400">
                            constellation {system.constellationId}
                          </div>
                        </div>
                        <div className="font-data rounded-full border border-slate-200/80 px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
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
                <div className="font-display text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
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
                          <div className="font-display font-medium tracking-[-0.02em] text-slate-900 dark:text-slate-100">
                            {corridor.from.name} to {corridor.to.name}
                          </div>
                          <div className="font-data text-xs text-slate-500 dark:text-slate-400">
                            regions {corridor.from.regionId} / {corridor.to.regionId}
                          </div>
                        </div>
                        <div className="font-data rounded-full border border-slate-200/80 px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
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
                <div className="font-display text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  System sample
                </div>
                <div className="font-display mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                  {positionedSystems.length}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="font-display text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Visible links
                </div>
                <div className="font-display mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                  {gateEdges.length}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="font-display text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Anchor clusters
                </div>
                <div className="font-display mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
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
