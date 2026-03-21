'use client'

import { Html, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { normalizeSpatialSystems } from '../../world/spatial-layout'
import type { MapLink, MapSystem } from '../../world/types'

type PositionedSystem = MapSystem & {
  position: [number, number, number]
}

type ControlsHandle = {
  target: THREE.Vector3
  update: () => void
}

const ATLAS_SCENE_SCALE = 800
const ATLAS_CAMERA_HOME_Z = 500
const ATLAS_FOCUS_PULLBACK = 200

type OverviewSpatialAtlasProps = {
  systems: MapSystem[]
  gateLinks: Array<Pick<MapLink, 'fromId' | 'toId'>>
  onHoverSystem: (system: MapSystem | null) => void
  highlightedPathIds?: number[]
  selectedSystemId?: number | null
  originSystemId?: number | null
  destinationSystemId?: number | null
  showGateLinks?: boolean
  routeOnly?: boolean
  resetSignal?: number
  isDarkMode?: boolean
  onSelectSystemId?: (systemId: number) => void
}

function getRegionColor(regionId: number, isDarkMode: boolean) {
  const colors = isDarkMode
    ? ['#7dd3fc', '#38bdf8', '#22d3ee', '#a78bfa', '#f59e0b', '#fb7185']
    : ['#0f766e', '#0284c7', '#0891b2', '#7c3aed', '#b45309', '#be123c']

  return colors[Math.abs(regionId) % colors.length]
}

function normalizeSystems(systems: MapSystem[]): PositionedSystem[] {
  return normalizeSpatialSystems(systems, ATLAS_SCENE_SCALE)
}

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453

  return value - Math.floor(value)
}

function BackgroundField({
  color,
  opacity,
}: {
  color: string
  opacity: number
}) {
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
        color={color}
        size={1.1}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </points>
  )
}

function OrbitGuide({
  color,
  opacity,
}: {
  color: string
  opacity: number
}) {
  const rings = useMemo(() => [42, 76, 112], [])

  return (
    <group rotation={[-Math.PI / 2.7, 0, 0]}>
      {rings.map((radius) => (
        <mesh key={radius}>
          <ringGeometry args={[radius - 0.18, radius + 0.18, 96]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

function SceneRig({ children }: { children: React.ReactNode }) {
  return <group>{children}</group>
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
  const targetPositionRef = useRef(new THREE.Vector3(0, 0, ATLAS_CAMERA_HOME_Z))
  const lookAtRef = useRef(new THREE.Vector3(0, 0, 0))
  const lastResetSignalRef = useRef(resetSignal)

  useFrame(() => {
    const camera = cameraRef.current
    if (camera == null) return

    if (lastResetSignalRef.current !== resetSignal) {
      lastResetSignalRef.current = resetSignal
      targetPositionRef.current.set(0, 0, ATLAS_CAMERA_HOME_Z)
      lookAtRef.current.set(0, 0, 0)
    }

    if (selectedSystem != null) {
      const point = new THREE.Vector3(...selectedSystem.position)
      const direction =
        point.lengthSq() > 0
          ? point.clone().normalize()
          : new THREE.Vector3(0, 0, 1)

      targetPositionRef.current.copy(
        point.clone().add(direction.multiplyScalar(ATLAS_FOCUS_PULLBACK))
      )
      lookAtRef.current.copy(point)
    } else {
      targetPositionRef.current.set(0, 0, ATLAS_CAMERA_HOME_Z)
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
  color,
  opacity,
}: {
  systems: PositionedSystem[]
  gateLinks: Array<Pick<MapLink, 'fromId' | 'toId'>>
  color: string
  opacity: number
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
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  )
}

function HighlightedPath({
  systems,
  highlightedPathIds,
  primaryColor,
  secondaryColor,
  secondaryOpacity,
}: {
  systems: PositionedSystem[]
  highlightedPathIds: number[]
  primaryColor: string
  secondaryColor: string
  secondaryOpacity: number
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
        <lineBasicMaterial color={primaryColor} transparent opacity={0.95} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={secondaryColor} transparent opacity={secondaryOpacity} />
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
  isDarkMode,
}: {
  system: PositionedSystem
  color: string
  size: number
  opacity: number
  withLabel?: boolean
  isDarkMode: boolean
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
          <div
            className={
              isDarkMode
                ? 'rounded-full border border-white/15 bg-slate-950/85 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white shadow-[0_12px_36px_rgba(2,6,23,0.45)] backdrop-blur'
                : 'rounded-full border border-stone-300/70 bg-white/88 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-stone-900 shadow-[0_12px_36px_rgba(96,74,40,0.18)] backdrop-blur'
            }
          >
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
  isDarkMode,
  onHoverSystem,
  onSelectSystem,
}: {
  systems: PositionedSystem[]
  selectedId: number | null
  originId: number | null
  destinationId: number | null
  highlightedPathIds: number[]
  isDarkMode: boolean
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
              ? isDarkMode
                ? '#f8fafc'
                : '#111827'
              : getRegionColor(system.regionId, isDarkMode)
        const baseRadius = isSelected ? 12 : isOnPath ? 9 : 6
        const haloOpacity = isSelected
          ? isDarkMode
            ? 0.16
            : 0.12
          : isOnPath || isOrigin || isDestination
            ? isDarkMode
              ? 0.13
              : 0.1
            : isDarkMode
              ? 0.06
              : 0.045

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
                opacity={haloOpacity}
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
  isDarkMode = true,
  onSelectSystemId,
}: OverviewSpatialAtlasProps) {
  const palette = isDarkMode
    ? {
        canvasBg: 'linear-gradient(180deg,#020617,#0f172a 38%,#111827)',
        hudSurface:
          'border-white/10 bg-slate-950/70 text-white shadow-[0_18px_40px_rgba(2,6,23,0.35)]',
        hudEyebrow: 'text-sky-200/90',
        hudText: 'text-slate-200',
        legendOrigin:
          'border-emerald-400/25 bg-emerald-400/12 text-emerald-100',
        legendDestination:
          'border-rose-400/25 bg-rose-400/12 text-rose-100',
        legendRoute:
          'border-sky-300/25 bg-sky-300/12 text-sky-100',
        fog: '#020617',
        starColor: '#cbd5e1',
        starOpacity: 0.72,
        orbitColor: '#7dd3fc',
        orbitOpacity: 0.08,
        gateColor: '#38bdf8',
        gateOpacity: 0.12,
        pathPrimary: '#f8fafc',
        pathSecondary: '#38bdf8',
        pathSecondaryOpacity: 0.45,
        originBeaconOpacity: 0.24,
        destinationBeaconOpacity: 0.24,
        selectedBeaconOpacity: 0.18,
        ambientLight: 0.72,
        keyLightColor: '#7dd3fc',
        keyLightIntensity: 1.15,
        rimLightColor: '#c084fc',
        rimLightIntensity: 0.42,
      }
    : {
        canvasBg: 'linear-gradient(180deg,#f8f4eb,#e4ded1 38%,#d6dde3)',
        hudSurface:
          'border-stone-300/70 bg-white/78 text-stone-900 shadow-[0_18px_40px_rgba(96,74,40,0.16)]',
        hudEyebrow: 'text-stone-500',
        hudText: 'text-stone-700',
        legendOrigin:
          'border-emerald-300/50 bg-emerald-50/85 text-emerald-700',
        legendDestination:
          'border-rose-300/50 bg-rose-50/85 text-rose-700',
        legendRoute:
          'border-cyan-300/50 bg-cyan-50/85 text-cyan-700',
        fog: '#f6efe4',
        starColor: '#94a3b8',
        starOpacity: 0.42,
        orbitColor: '#c0841a',
        orbitOpacity: 0.11,
        gateColor: '#0f766e',
        gateOpacity: 0.16,
        pathPrimary: '#0f172a',
        pathSecondary: '#0891b2',
        pathSecondaryOpacity: 0.28,
        originBeaconOpacity: 0.17,
        destinationBeaconOpacity: 0.17,
        selectedBeaconOpacity: 0.13,
        ambientLight: 0.95,
        keyLightColor: '#f59e0b',
        keyLightIntensity: 0.78,
        rimLightColor: '#22c55e',
        rimLightIntensity: 0.2,
      }
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
    <div className="relative h-[560px] w-full overflow-hidden" style={{ background: palette.canvasBg }}>
      <div className={`absolute left-4 top-4 z-10 rounded-[1.1rem] border px-4 py-3 backdrop-blur ${palette.hudSurface}`}>
        <div className={`text-[10px] uppercase tracking-[0.32em] ${palette.hudEyebrow}`}>
          Live Spatial View
        </div>
        <div className={`mt-2 text-sm ${palette.hudText}`}>
          Click to lock focus, drag to orbit, scroll to compress or expand sector depth.
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
        <div className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] backdrop-blur ${palette.legendOrigin}`}>
          Origin marker
        </div>
        <div className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] backdrop-blur ${palette.legendDestination}`}>
          Destination marker
        </div>
        <div className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] backdrop-blur ${palette.legendRoute}`}>
          Route corridor
        </div>
      </div>

      <Canvas gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[0, 0, ATLAS_CAMERA_HOME_Z]}
          fov={60}
          near={0.1}
          far={10000}
        />
        <ambientLight intensity={palette.ambientLight} />
        <pointLight
          position={[120, 90, 140]}
          intensity={palette.keyLightIntensity}
          color={palette.keyLightColor}
        />
        <pointLight
          position={[-80, -60, -120]}
          intensity={palette.rimLightIntensity}
          color={palette.rimLightColor}
        />
        <fog attach="fog" args={[palette.fog, 420, 1400]} />
        <BackgroundField color={palette.starColor} opacity={palette.starOpacity} />
        <OrbitGuide color={palette.orbitColor} opacity={palette.orbitOpacity} />
        <CameraFlight
          cameraRef={cameraRef}
          controlsRef={controlsRef}
          selectedSystem={selectedSystem}
          resetSignal={resetSignal}
        />
        <SceneRig>
          {showGateLinks ? (
            <GateLinks
              systems={positionedSystems}
              gateLinks={gateLinks}
              color={palette.gateColor}
              opacity={palette.gateOpacity}
            />
          ) : null}
          <HighlightedPath
            systems={positionedSystems}
            highlightedPathIds={highlightedPathIds}
            primaryColor={palette.pathPrimary}
            secondaryColor={palette.pathSecondary}
            secondaryOpacity={palette.pathSecondaryOpacity}
          />
          <SystemsLayer
            systems={visibleSystems}
            selectedId={effectiveSelectedId}
            originId={originSystemId}
            destinationId={destinationSystemId}
            highlightedPathIds={highlightedPathIds}
            isDarkMode={isDarkMode}
            onHoverSystem={onHoverSystem}
            onSelectSystem={(system) => {
              setInternalSelectedId(system.id)
              onSelectSystemId?.(system.id)
            }}
          />
          {originSystem ? (
            <SelectionBeacon
              system={originSystem}
              color="#34d399"
              size={18}
              opacity={palette.originBeaconOpacity}
              isDarkMode={isDarkMode}
            />
          ) : null}
          {destinationSystem ? (
            <SelectionBeacon
              system={destinationSystem}
              color="#fb7185"
              size={20}
              opacity={palette.destinationBeaconOpacity}
              isDarkMode={isDarkMode}
            />
          ) : null}
          {selectedSystem ? (
            <SelectionBeacon
              system={selectedSystem}
              color="#f8fafc"
              size={28}
              opacity={palette.selectedBeaconOpacity}
              withLabel
              isDarkMode={isDarkMode}
            />
          ) : null}
        </SceneRig>
        <OrbitControls
          ref={(value) => {
            controlsRef.current = value as unknown as ControlsHandle | null
          }}
          enablePan={false}
          enableDamping
          dampingFactor={0.1}
          minDistance={10}
          maxDistance={3000}
          rotateSpeed={0.5}
          zoomSpeed={1.2}
        />
      </Canvas>
    </div>
  )
}
