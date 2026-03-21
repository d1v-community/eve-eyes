'use client'

import { useEffect, useMemo, useRef } from 'react'
import { projectSpatialSystemsToViewport } from '../../world/spatial-layout'
import type { MapConstellation, MapLink, MapSystem } from '../../world/types'

type Anchor = {
  id: number
  name: string
  regionId: number
  x: number
  y: number
  count: number
}

type Corridor = {
  fromId: number
  toId: number
  weight: number
  from: Anchor
  to: Anchor
}

type OverviewCorridorDeckProps = {
  systems: MapSystem[]
  constellations: MapConstellation[]
  gateLinks: MapLink[]
  onHoverCorridor: (corridor: Corridor | null) => void
  onSelectCorridor?: (corridor: Corridor | null) => void
  selectedCorridorKey?: string | null
}

type DeckHandle = {
  finalize: () => void
  setProps: (props: Record<string, unknown>) => void
}

const WIDTH = 880
const HEIGHT = 480
const PADDING = 56

function buildAnchors(systems: MapSystem[], constellations: MapConstellation[]) {
  const projectedSystems = projectSpatialSystemsToViewport(systems, {
    width: WIDTH,
    height: HEIGHT,
    padding: PADDING,
  })
  const grouped = new Map<number, { x: number; y: number; count: number }>()

  for (const system of projectedSystems) {
    const current = grouped.get(system.constellationId) ?? { x: 0, y: 0, count: 0 }
    current.x += system.px
    current.y += system.py
    current.count += 1
    grouped.set(system.constellationId, current)
  }

  return constellations
    .map((constellation) => {
      const current = grouped.get(constellation.id)
      if (current == null || current.count === 0) return null

      return {
        id: constellation.id,
        name: constellation.name,
        regionId: constellation.regionId,
        x: current.x / current.count,
        y: current.y / current.count,
        count: current.count,
      }
    })
    .filter((value): value is Anchor => value != null)
}

function buildCorridors(
  systems: MapSystem[],
  gateLinks: MapLink[],
  anchors: Anchor[]
) {
  const systemById = new Map(systems.map((system) => [system.id, system]))
  const anchorById = new Map(anchors.map((anchor) => [anchor.id, anchor]))
  const grouped = new Map<string, { fromId: number; toId: number; weight: number }>()

  for (const link of gateLinks) {
    const fromSystem = systemById.get(link.fromId)
    if (fromSystem == null) continue

    const left = Math.min(fromSystem.constellationId, link.toConstellationId)
    const right = Math.max(fromSystem.constellationId, link.toConstellationId)
    if (left === right) continue

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
    .slice(0, 18)
}

export default function OverviewCorridorDeck({
  systems,
  constellations,
  gateLinks,
  onHoverCorridor,
  onSelectCorridor,
  selectedCorridorKey,
}: OverviewCorridorDeckProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const deckRef = useRef<DeckHandle | null>(null)

  const anchors = useMemo(() => buildAnchors(systems, constellations), [systems, constellations])
  const corridors = useMemo(
    () => buildCorridors(systems, gateLinks, anchors),
    [systems, gateLinks, anchors]
  )
  const center = useMemo(() => {
    if (anchors.length === 0) return { x: WIDTH / 2, y: HEIGHT / 2 }

    const sum = anchors.reduce(
      (acc, anchor) => ({ x: acc.x + anchor.x, y: acc.y + anchor.y }),
      { x: 0, y: 0 }
    )

    return { x: sum.x / anchors.length, y: sum.y / anchors.length }
  }, [anchors])

  useEffect(() => {
    const container = containerRef.current
    if (container == null) return
    let cancelled = false

    const setup = async () => {
      const [{ Deck, OrthographicView }, { ArcLayer, ScatterplotLayer }] = await Promise.all([
        import('@deck.gl/core'),
        import('@deck.gl/layers'),
      ])
      if (cancelled) return

      const nextDeck = new Deck({
        parent: container,
        controller: true,
        views: new OrthographicView({ id: 'ortho' }),
        initialViewState: {
          target: [center.x, center.y, 0],
          zoom: 0,
        },
        getTooltip: ({ object }: { object?: Corridor | Anchor }) => {
          if (object == null) return null
          if ('weight' in object) {
            return { text: `${object.from.name} -> ${object.to.name} · ${object.weight} links` }
          }

          return { text: `${object.name} · ${object.count} systems` }
        },
        layers: [
          new ArcLayer<Corridor>({
            id: 'corridors',
            data: corridors,
            pickable: true,
            getSourcePosition: (d) => [d.from.x, d.from.y],
            getTargetPosition: (d) => [d.to.x, d.to.y],
            getSourceColor: (d) =>
              selectedCorridorKey === `${d.fromId}-${d.toId}`
                ? [248, 250, 252, 255]
                : [34, 211, 238, 120],
            getTargetColor: (d) =>
              selectedCorridorKey === `${d.fromId}-${d.toId}`
                ? [248, 250, 252, 255]
                : [232, 121, 249, 120],
            getWidth: (d) =>
              selectedCorridorKey === `${d.fromId}-${d.toId}`
                ? 8 + d.weight * 1.2
                : 3 + d.weight * 0.8,
            onHover: ({ object }) => onHoverCorridor(object ?? null),
            onClick: ({ object }) => onSelectCorridor?.(object ?? null),
          }),
          new ScatterplotLayer<Anchor>({
            id: 'anchors',
            data: anchors,
            pickable: false,
            radiusUnits: 'pixels',
            getPosition: (d) => [d.x, d.y],
            getRadius: (d) => 6 + d.count * 1.4,
            getFillColor: (d) => [125, 211, 252, d.count > 2 ? 190 : 130],
            stroked: true,
            getLineColor: [248, 250, 252, 120],
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: 1,
          }),
        ],
      }) as DeckHandle

      deckRef.current = nextDeck
    }

    void setup()

    return () => {
      cancelled = true
      deckRef.current?.finalize()
      deckRef.current = null
      onHoverCorridor(null)
    }
  }, [anchors, center.x, center.y, corridors, onHoverCorridor, onSelectCorridor, selectedCorridorKey])

  return (
    <div className="relative h-[480px] w-full overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,#f8fbff,#eef6ff_42%,#e2e8f0)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,#020617,#0f172a_42%,#111827)]">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/70 to-transparent dark:from-slate-950/25" />
    </div>
  )
}
