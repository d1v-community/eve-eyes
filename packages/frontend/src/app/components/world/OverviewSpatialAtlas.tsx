'use client'

import { Html, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

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
  position: [number, number, number]
}

type ControlsHandle = {
  target: THREE.Vector3
  update: () => void
}

type OverviewSpatialAtlasProps = {
  systems: MapSystem[]
  gateLinks: MapLink[]
  onHoverSystem: (system: MapSystem | null) => void
  highlightedPathIds?: number[]
  selectedSystemId?: number | null
  originSystemId?: number | null
  destinationSystemId?: number | null
  showGateLinks?: boolean
  routeOnly?: boolean
  resetSignal?: number
  onSelectSystemId?: (systemId: number) => void
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
  let minZ = Infinity
  let maxZ = -Infinity

  for (const system of systems) {
    if (system.location.x < minX) minX = system.location.x
    if (system.location.x > maxX) maxX = system.location.x
    if (system.location.y < minY) minY = system.location.y
    if (system.location.y > maxY) maxY = system.location.y
    if (system.location.z < minZ) minZ = system.location.z
    if (system.location.z > maxZ) maxZ = system.location.z
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const rangeZ = maxZ - minZ || 1
  const scale = 180

  return systems.map((system) => ({
    ...system,
    position: [
      ((system.location.x - minX) / rangeX - 0.5) * scale,
      ((system.location.y - minY) / rangeY - 0.5) * scale,
      ((system.location.z - minZ) / rangeZ - 0.5) * scale,
    ],
  }))
}

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453

  return value - Math.floor(value)
}

function BackgroundField() {
  const pointsRef = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const values = new Float32Array(900 * 3)

    for (let index = 0; index < 900; index += 1) {
      values[index * 3] = (pseudoRandom(index + 1) - 0.5) * 1400
      values[index * 3 + 1] = (pseudoRandom(index + 101) - 0.5) * 1000
      values[index * 3 + 2] = (pseudoRandom(index + 1001) - 0.5) * 1400
    }

    return values
  }, [])

  useFrame((_, delta) => {
    if (pointsRef.current == null) return
    pointsRef.current.rotation.y += delta * 0.006
    pointsRef.current.rotation.x += delta * 0.0015
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#cbd5e1"
        size={1.1}
        sizeAttenuation
        transparent
        opacity={0.72}
        depthWrite={false}
      />
    </points>
  )
}

function OrbitGuide() {
  const rings = useMemo(() => [42, 76, 112], [])

  return (
    <group rotation={[-Math.PI / 2.7, 0, 0]}>
      {rings.map((radius) => (
        <mesh key={radius}>
          <ringGeometry args={[radius - 0.18, radius + 0.18, 96]} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.08} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

function SceneRig({
  children,
  lockRotation,
}: {
  children: React.ReactNode
  lockRotation: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (groupRef.current == null) return

    const targetY = lockRotation ? 0 : Math.sin(clock.getElapsedTime() * 0.1) * 0.07
    const targetX = lockRotation ? 0 : Math.cos(clock.getElapsedTime() * 0.07) * 0.025

    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.08
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.08
  })

  return <group ref={groupRef}>{children}</group>
}

function CameraFlight({
  cameraRef,
  controlsRef,
  selectedSystem,
  resetSignal,
}: {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>
  controlsRef: React.RefObject<ControlsHandle | null>
  selectedSystem: PositionedSystem | null
  resetSignal: number
}) {
  const targetPositionRef = useRef(new THREE.Vector3(0, 0, 235))
  const lookAtRef = useRef(new THREE.Vector3(0, 0, 0))
  const lastResetSignalRef = useRef(resetSignal)

  useFrame(() => {
    const camera = cameraRef.current
    if (camera == null) return

    if (lastResetSignalRef.current !== resetSignal) {
      lastResetSignalRef.current = resetSignal
      targetPositionRef.current.set(0, 0, 235)
      lookAtRef.current.set(0, 0, 0)
    }

    if (selectedSystem != null) {
      targetPositionRef.current.set(
        selectedSystem.position[0] * 0.4,
        selectedSystem.position[1] * 0.4,
        selectedSystem.position[2] + 55
      )
      lookAtRef.current.set(...selectedSystem.position)
    } else {
      targetPositionRef.current.set(0, 0, 235)
      lookAtRef.current.set(0, 0, 0)
    }

    camera.position.lerp(targetPositionRef.current, 0.08)
    if (controlsRef.current != null) {
      controlsRef.current.target.lerp(lookAtRef.current, 0.1)
      controlsRef.current.update()
    } else {
      camera.lookAt(lookAtRef.current)
    }
  })

  return null
}

function GateLinks({
  systems,
  gateLinks,
}: {
  systems: PositionedSystem[]
  gateLinks: MapLink[]
}) {
  const positions = useMemo(() => {
    const systemById = new Map(systems.map((system) => [system.id, system]))
    const values: number[] = []

    for (const link of gateLinks) {
      const from = systemById.get(link.fromId)
      const to = systemById.get(link.toId)

      if (from == null || to == null) continue

      values.push(...from.position, ...to.position)
    }

    return new Float32Array(values)
  }, [systems, gateLinks])

  if (positions.length === 0) return null

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#38bdf8" transparent opacity={0.12} />
    </lineSegments>
  )
}

function HighlightedPath({
  systems,
  highlightedPathIds,
}: {
  systems: PositionedSystem[]
  highlightedPathIds: number[]
}) {
  const positions = useMemo(() => {
    const systemById = new Map(systems.map((system) => [system.id, system]))
    const values: number[] = []

    for (const id of highlightedPathIds) {
      const system = systemById.get(id)
      if (system == null) continue
      values.push(...system.position)
    }

    return new Float32Array(values)
  }, [systems, highlightedPathIds])

  if (positions.length < 6) return null

  return (
    <>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#f8fafc" transparent opacity={0.95} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.45} />
      </line>
    </>
  )
}

function SelectionBeacon({
  system,
  color,
  size,
  opacity,
  withLabel = false,
}: {
  system: PositionedSystem
  color: string
  size: number
  opacity: number
  withLabel?: boolean
}) {
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (ringRef.current == null) return
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 2.4) * 0.12
    ringRef.current.scale.setScalar(pulse)
  })

  return (
    <group position={system.position}>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size, size + 0.7, 48]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
      </mesh>
      {withLabel ? (
        <Html center distanceFactor={14}>
          <div className="rounded-full border border-white/15 bg-slate-950/85 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white shadow-[0_12px_36px_rgba(2,6,23,0.45)] backdrop-blur">
            {system.name}
          </div>
        </Html>
      ) : null}
    </group>
  )
}

function SystemsLayer({
  systems,
  selectedId,
  originId,
  destinationId,
  highlightedPathIds,
  onHoverSystem,
  onSelectSystem,
}: {
  systems: PositionedSystem[]
  selectedId: number | null
  originId: number | null
  destinationId: number | null
  highlightedPathIds: number[]
  onHoverSystem: (system: MapSystem | null) => void
  onSelectSystem: (system: PositionedSystem) => void
}) {
  const highlightedSet = useMemo(() => new Set(highlightedPathIds), [highlightedPathIds])

  return (
    <>
      {systems.map((system) => {
        const isSelected = system.id === selectedId
        const isOnPath = highlightedSet.has(system.id)
        const isOrigin = system.id === originId
        const isDestination = system.id === destinationId
        const color = isOrigin
          ? '#34d399'
          : isDestination
            ? '#fb7185'
            : isOnPath
              ? '#f8fafc'
              : getRegionColor(system.regionId)
        const baseRadius = isSelected ? 2.7 : isOnPath ? 2.05 : 1.35

        return (
          <group key={system.id} position={system.position}>
            <mesh
              onPointerOver={() => onHoverSystem(system)}
              onPointerOut={() => onHoverSystem(null)}
              onClick={() => onSelectSystem(system)}
            >
              <sphereGeometry args={[baseRadius, 18, 18]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh>
              <sphereGeometry args={[baseRadius * 2.3, 18, 18]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isSelected ? 0.16 : isOnPath || isOrigin || isDestination ? 0.13 : 0.06}
              />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

export default function OverviewSpatialAtlas({
  systems,
  gateLinks,
  onHoverSystem,
  highlightedPathIds = [],
  selectedSystemId,
  originSystemId = null,
  destinationSystemId = null,
  showGateLinks = true,
  routeOnly = false,
  resetSignal = 0,
  onSelectSystemId,
}: OverviewSpatialAtlasProps) {
  const positionedSystems = useMemo(() => normalizeSystems(systems), [systems])
  const [internalSelectedId, setInternalSelectedId] = useState<number | null>(null)
  const effectiveSelectedId =
    selectedSystemId ?? internalSelectedId ?? highlightedPathIds[0] ?? systems[0]?.id ?? null
  const selectedSystem =
    positionedSystems.find((system) => system.id === effectiveSelectedId) ?? null
  const originSystem =
    positionedSystems.find((system) => system.id === originSystemId) ?? null
  const destinationSystem =
    positionedSystems.find((system) => system.id === destinationSystemId) ?? null
  const visibleSystems = useMemo(() => {
    if (!routeOnly || highlightedPathIds.length === 0) return positionedSystems

    const visibleIds = new Set([
      ...highlightedPathIds,
      ...(originSystemId != null ? [originSystemId] : []),
      ...(destinationSystemId != null ? [destinationSystemId] : []),
      ...(effectiveSelectedId != null ? [effectiveSelectedId] : []),
    ])

    return positionedSystems.filter((system) => visibleIds.has(system.id))
  }, [
    destinationSystemId,
    effectiveSelectedId,
    highlightedPathIds,
    originSystemId,
    positionedSystems,
    routeOnly,
  ])
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<ControlsHandle | null>(null)

  return (
    <div className="relative h-[560px] w-full overflow-hidden bg-[linear-gradient(180deg,#020617,#0f172a_38%,#111827)]">
      <div className="absolute left-4 top-4 z-10 rounded-[1.1rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-white shadow-[0_18px_40px_rgba(2,6,23,0.35)] backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.32em] text-sky-200/90">
          Live Spatial View
        </div>
        <div className="mt-2 text-sm text-slate-200">
          Click to lock focus, drag to orbit, scroll to compress or expand sector depth.
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
        <div className="rounded-full border border-emerald-400/25 bg-emerald-400/12 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-emerald-100 backdrop-blur">
          Origin marker
        </div>
        <div className="rounded-full border border-rose-400/25 bg-rose-400/12 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-rose-100 backdrop-blur">
          Destination marker
        </div>
        <div className="rounded-full border border-sky-300/25 bg-sky-300/12 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-sky-100 backdrop-blur">
          Route corridor
        </div>
      </div>

      <Canvas gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[0, 0, 235]}
          fov={50}
          near={0.1}
          far={2400}
        />
        <ambientLight intensity={0.72} />
        <pointLight position={[120, 90, 140]} intensity={1.15} color="#7dd3fc" />
        <pointLight position={[-80, -60, -120]} intensity={0.42} color="#c084fc" />
        <fog attach="fog" args={['#020617', 190, 560]} />
        <BackgroundField />
        <OrbitGuide />
        <CameraFlight
          cameraRef={cameraRef}
          controlsRef={controlsRef}
          selectedSystem={selectedSystem}
          resetSignal={resetSignal}
        />
        <SceneRig lockRotation={selectedSystem != null}>
          {showGateLinks ? (
            <GateLinks systems={positionedSystems} gateLinks={gateLinks} />
          ) : null}
          <HighlightedPath
            systems={positionedSystems}
            highlightedPathIds={highlightedPathIds}
          />
          <SystemsLayer
            systems={visibleSystems}
            selectedId={effectiveSelectedId}
            originId={originSystemId}
            destinationId={destinationSystemId}
            highlightedPathIds={highlightedPathIds}
            onHoverSystem={onHoverSystem}
            onSelectSystem={(system) => {
              setInternalSelectedId(system.id)
              onSelectSystemId?.(system.id)
            }}
          />
          {originSystem ? (
            <SelectionBeacon system={originSystem} color="#34d399" size={4.2} opacity={0.24} />
          ) : null}
          {destinationSystem ? (
            <SelectionBeacon
              system={destinationSystem}
              color="#fb7185"
              size={4.6}
              opacity={0.24}
            />
          ) : null}
          {selectedSystem ? (
            <SelectionBeacon
              system={selectedSystem}
              color="#f8fafc"
              size={6.2}
              opacity={0.18}
              withLabel
            />
          ) : null}
        </SceneRig>
        <OrbitControls
          ref={(value) => {
            controlsRef.current = value as unknown as ControlsHandle | null
          }}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={42}
          maxDistance={420}
          rotateSpeed={0.45}
          zoomSpeed={0.82}
        />
      </Canvas>
    </div>
  )
}
