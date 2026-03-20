'use client'

import { useEffect, useMemo, useRef } from 'react'

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

type MapLink = {
  fromId: number
  toId: number
}

type PositionedSystem = MapSystem & {
  x: number
  y: number
}

type OverviewNetworkGraphProps = {
  systems: MapSystem[]
  gateLinks: MapLink[]
  onHoverSystem: (system: MapSystem | null) => void
  onSelectSystemId?: (systemId: number) => void
  selectedSystemId?: number | null
}

type SigmaHandle = {
  kill: () => void
  on: (
    event: 'enterNode' | 'leaveNode' | 'clickNode',
    cb: (payload?: { node: string }) => void
  ) => void
}

function getRegionColor(regionId: number) {
  const colors = ['#7dd3fc', '#38bdf8', '#22d3ee', '#a78bfa', '#f59e0b', '#fb7185']

  return colors[Math.abs(regionId) % colors.length]
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

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1

  return systems.map((system) => ({
    ...system,
    x: ((system.location.x - minX) / rangeX - 0.5) * 18,
    y: ((system.location.y - minY) / rangeY - 0.5) * 12,
  }))
}

export default function OverviewNetworkGraph({
  systems,
  gateLinks,
  onHoverSystem,
  onSelectSystemId,
  selectedSystemId,
}: OverviewNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sigmaRef = useRef<SigmaHandle | null>(null)
  const positionedSystems = useMemo(() => normalizeSystems(systems), [systems])

  useEffect(() => {
    const container = containerRef.current
    if (container == null) return
    let cancelled = false
    let renderer: SigmaHandle | null = null

    const setup = async () => {
      const [{ default: Graph }, { default: Sigma }] = await Promise.all([
        import('graphology'),
        import('sigma'),
      ])
      if (cancelled) return

      const graph = new Graph()
      const systemById = new Map(positionedSystems.map((system) => [system.id, system]))

      for (const system of positionedSystems) {
        const isSelected = system.id === selectedSystemId

        graph.addNode(String(system.id), {
          x: system.x,
          y: system.y,
          size: isSelected ? 12 : 7,
          label: system.name,
          color: isSelected ? '#f8fafc' : getRegionColor(system.regionId),
        })
      }

      const seenEdges = new Set<string>()

      for (const link of gateLinks) {
        const from = systemById.get(link.fromId)
        const to = systemById.get(link.toId)

        if (from == null || to == null) continue

        const edgeKey = `${Math.min(from.id, to.id)}-${Math.max(from.id, to.id)}`
        if (seenEdges.has(edgeKey)) continue
        seenEdges.add(edgeKey)

        graph.addEdge(String(from.id), String(to.id), {
          size: 1.3,
          color: '#7dd3fc',
        })
      }

      renderer = new Sigma(graph, container, {
        allowInvalidContainer: true,
        renderLabels: false,
        renderEdgeLabels: false,
        labelDensity: 0.05,
        defaultEdgeType: 'line',
        defaultNodeType: 'circle',
        enableEdgeEvents: false,
        zIndex: true,
      })

      sigmaRef.current = renderer

      renderer.on('enterNode', (payload?: { node: string }) => {
        if (payload == null) return
        const { node } = payload
        const system = systemById.get(Number(node)) ?? null
        onHoverSystem(system)
      })

      renderer.on('leaveNode', () => {
        onHoverSystem(null)
      })

      renderer.on('clickNode', (payload?: { node: string }) => {
        if (payload == null) return
        const { node } = payload
        onSelectSystemId?.(Number(node))
      })
    }

    void setup()

    return () => {
      cancelled = true
      onHoverSystem(null)
      sigmaRef.current = null
      renderer?.kill()
    }
  }, [gateLinks, onHoverSystem, onSelectSystemId, positionedSystems, selectedSystemId])

  return (
    <div className="relative h-[480px] w-full overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,#020617,#0f172a_42%,#111827)] dark:border-slate-800">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-950/25 to-transparent" />
    </div>
  )
}
