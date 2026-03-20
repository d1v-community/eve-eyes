'use client'

import { Network, Orbit, Radar } from 'lucide-react'
import { useMemo, useState } from 'react'
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

const REGION_COLORS = ['#7dd3fc', '#38bdf8', '#22d3ee', '#a78bfa', '#f59e0b', '#fb7185']

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

function getRegionColor(regionId: number) {
  return REGION_COLORS[Math.abs(regionId) % REGION_COLORS.length]
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
  const highlightedSystems = positionedSystems.slice(0, 6)

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
              onHoverSystem={setHoveredSystem}
            />
          ) : (
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-full w-full"
              role="img"
              aria-label={activeMode.title}
            >
              <defs>
                <radialGradient id="overview-grid-glow" cx="50%" cy="46%" r="65%">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.18" />
                  <stop offset="55%" stopColor="#312e81" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="corridor-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#f0abfc" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              <rect width={WIDTH} height={HEIGHT} fill="#020617" />
              <rect width={WIDTH} height={HEIGHT} fill="url(#overview-grid-glow)" />

              {Array.from({ length: 12 }).map((_, index) => (
                <line
                  key={`v-${index}`}
                  x1={(WIDTH / 12) * index}
                  y1="0"
                  x2={(WIDTH / 12) * index}
                  y2={HEIGHT}
                  stroke="rgba(148,163,184,0.08)"
                  strokeWidth="1"
                />
              ))}
              {Array.from({ length: 8 }).map((_, index) => (
                <line
                  key={`h-${index}`}
                  x1="0"
                  y1={(HEIGHT / 8) * index}
                  x2={WIDTH}
                  y2={(HEIGHT / 8) * index}
                  stroke="rgba(148,163,184,0.08)"
                  strokeWidth="1"
                />
              ))}

              {mode === 'network' &&
                gateEdges.map((edge) => (
                  <line
                    key={edge.id}
                    x1={edge.from.px}
                    y1={edge.from.py}
                    x2={edge.to.px}
                    y2={edge.to.py}
                    stroke="rgba(125,211,252,0.32)"
                    strokeWidth="1.4"
                  />
                ))}

              {mode === 'corridor' &&
                corridors.map((corridor) => (
                  <g key={`${corridor.fromId}-${corridor.toId}`}>
                    <line
                      x1={corridor.from.x}
                      y1={corridor.from.y}
                      x2={corridor.to.x}
                      y2={corridor.to.y}
                      stroke="url(#corridor-stroke)"
                      strokeWidth={1.5 + corridor.weight * 1.2}
                      strokeLinecap="round"
                      opacity="0.75"
                    />
                    <circle
                      cx={(corridor.from.x + corridor.to.x) / 2}
                      cy={(corridor.from.y + corridor.to.y) / 2}
                      r={2 + corridor.weight * 0.7}
                      fill="#e879f9"
                      opacity="0.65"
                    />
                  </g>
                ))}

              {positionedSystems.map((system) => (
                <g key={system.id}>
                  <circle
                    cx={system.px}
                    cy={system.py}
                    r={mode === 'corridor' ? 2.4 : 3.2}
                    fill={getRegionColor(system.regionId)}
                    opacity={mode === 'network' ? 0.95 : 0.88}
                  />
                  <circle
                    cx={system.px}
                    cy={system.py}
                    r={mode === 'network' ? 6 : 8}
                    fill={getRegionColor(system.regionId)}
                    opacity="0.08"
                  />
                </g>
              ))}

              {highlightedSystems.map((system, index) => (
                <g key={`label-${system.id}`}>
                  <circle
                    cx={system.px}
                    cy={system.py}
                    r="5"
                    fill="#f8fafc"
                    opacity={index === 0 ? '0.95' : '0.78'}
                  />
                  <text
                    x={system.px + 10}
                    y={system.py - 10}
                    fill="#e2e8f0"
                    fontSize="12"
                    fontWeight="600"
                  >
                    {system.name}
                  </text>
                </g>
              ))}
            </svg>
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
            {mode === 'spatial' && hoveredSystem ? (
              <div className="mb-4 rounded-2xl border border-sky-200/70 bg-sky-50/80 p-4 text-sm leading-6 text-slate-700 dark:border-sky-900/70 dark:bg-sky-950/20 dark:text-slate-200">
                <div className="text-xs uppercase tracking-[0.24em] text-sky-700 dark:text-sky-300">
                  Hovered system
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                  {hoveredSystem.name}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  System #{hoveredSystem.id} · constellation {hoveredSystem.constellationId} ·
                  region {hoveredSystem.regionId}
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
