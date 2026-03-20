'use client'

import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
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
  const scale = 160

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
    const values = new Float32Array(700 * 3)

    for (let index = 0; index < 700; index += 1) {
      values[index * 3] = (pseudoRandom(index + 1) - 0.5) * 1200
      values[index * 3 + 1] = (pseudoRandom(index + 101) - 0.5) * 900
      values[index * 3 + 2] = (pseudoRandom(index + 1001) - 0.5) * 1200
    }

    return values
  }, [])

  useFrame((_, delta) => {
    if (pointsRef.current == null) return
    pointsRef.current.rotation.y += delta * 0.008
    pointsRef.current.rotation.x += delta * 0.002
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#cbd5e1"
        size={1.2}
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
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

    const targetY = lockRotation ? 0 : Math.sin(clock.getElapsedTime() * 0.12) * 0.08
    const targetX = lockRotation ? 0 : Math.cos(clock.getElapsedTime() * 0.08) * 0.03

    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.08
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.08
  })

  return <group ref={groupRef}>{children}</group>
}

function CameraFlight({
  cameraRef,
  controlsRef,
  selectedSystem,
}: {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>
  controlsRef: React.RefObject<ControlsHandle | null>
  selectedSystem: PositionedSystem | null
}) {
  const targetPositionRef = useRef(new THREE.Vector3(0, 0, 220))
  const lookAtRef = useRef(new THREE.Vector3(0, 0, 0))

  useFrame(() => {
    const camera = cameraRef.current
    if (camera == null) return

    if (selectedSystem != null) {
      targetPositionRef.current.set(
        selectedSystem.position[0] * 0.35,
        selectedSystem.position[1] * 0.35,
        selectedSystem.position[2] + 48
      )
      lookAtRef.current.set(...selectedSystem.position)
    } else {
      targetPositionRef.current.set(0, 0, 220)
      lookAtRef.current.set(0, 0, 0)
    }

    camera.position.lerp(targetPositionRef.current, 0.08)
    if (controlsRef.current != null) {
      controlsRef.current.target.lerp(lookAtRef.current, 0.08)
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
      <lineBasicMaterial color="#7dd3fc" transparent opacity={0.18} />
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
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#f8fafc" transparent opacity={0.95} />
    </line>
  )
}

function SystemsLayer({
  systems,
  selectedId,
  highlightedPathIds,
  onHoverSystem,
  onSelectSystem,
}: {
  systems: PositionedSystem[]
  selectedId: number | null
  highlightedPathIds: number[]
  onHoverSystem: (system: MapSystem | null) => void
  onSelectSystem: (system: PositionedSystem) => void
}) {
  return (
    <>
      {systems.map((system) => {
        const isSelected = system.id === selectedId
        const isOnPath = highlightedPathIds.includes(system.id)
        const color = getRegionColor(system.regionId)

        return (
          <group key={system.id} position={system.position}>
            <mesh
              onPointerOver={() => onHoverSystem(system)}
              onPointerOut={() => onHoverSystem(null)}
              onClick={() => onSelectSystem(system)}
            >
              <sphereGeometry args={[isSelected ? 2.6 : isOnPath ? 2 : 1.4, 20, 20]} />
              <meshBasicMaterial color={isOnPath ? '#f8fafc' : color} />
            </mesh>
            <mesh>
              <sphereGeometry args={[isSelected ? 5.2 : isOnPath ? 4.8 : 3.8, 20, 20]} />
              <meshBasicMaterial
                color={isOnPath ? '#7dd3fc' : color}
                transparent
                opacity={isSelected ? 0.18 : isOnPath ? 0.15 : 0.08}
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
  onSelectSystemId,
}: OverviewSpatialAtlasProps) {
  const positionedSystems = useMemo(() => normalizeSystems(systems), [systems])
  const [internalSelectedId, setInternalSelectedId] = useState<number | null>(null)
  const effectiveSelectedId =
    selectedSystemId ?? internalSelectedId ?? highlightedPathIds[0] ?? systems[0]?.id ?? null
  const selectedSystem =
    positionedSystems.find((system) => system.id === effectiveSelectedId) ?? null
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<ControlsHandle | null>(null)

  return (
    <div className="relative h-[480px] w-full">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(14,165,233,0.12),transparent_32%),radial-gradient(circle_at_75%_30%,rgba(168,85,247,0.1),transparent_24%),linear-gradient(180deg,#020617,#0f172a_42%,#111827)]" />
      <Canvas
        gl={{ antialias: true, alpha: true }}
      >
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[0, 0, 220]}
          fov={52}
          near={0.1}
          far={2000}
        />
        <ambientLight intensity={0.75} />
        <pointLight position={[120, 90, 140]} intensity={1.2} color="#7dd3fc" />
        <pointLight position={[-80, -60, -120]} intensity={0.45} color="#c084fc" />
        <fog attach="fog" args={['#020617', 180, 520]} />
        <BackgroundField />
        <CameraFlight
          cameraRef={cameraRef}
          controlsRef={controlsRef}
          selectedSystem={selectedSystem}
        />
        <SceneRig lockRotation={selectedSystem != null}>
          <GateLinks systems={positionedSystems} gateLinks={gateLinks} />
          <HighlightedPath
            systems={positionedSystems}
            highlightedPathIds={highlightedPathIds}
          />
          <SystemsLayer
            systems={positionedSystems}
            selectedId={effectiveSelectedId}
            highlightedPathIds={highlightedPathIds}
            onHoverSystem={onHoverSystem}
            onSelectSystem={(system) => {
              setInternalSelectedId(system.id)
              onSelectSystemId?.(system.id)
            }}
          />
        </SceneRig>
        <OrbitControls
          ref={(value) => {
            controlsRef.current = value as unknown as ControlsHandle | null
          }}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={40}
          maxDistance={380}
          rotateSpeed={0.45}
          zoomSpeed={0.8}
        />
      </Canvas>
    </div>
  )
}
