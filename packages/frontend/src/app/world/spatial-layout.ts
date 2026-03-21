import type { MapSystem } from './types'

export const DEFAULT_SPATIAL_SCALE = 800
const DEFAULT_PROJECTION_YAW = Math.PI / 5
const DEFAULT_PROJECTION_PITCH = -Math.PI / 7

type SpatialBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
  rangeX: number
  rangeY: number
  rangeZ: number
}

type ViewportProjectionOptions = {
  width: number
  height: number
  padding: number
}

export function getSpatialBounds(systems: MapSystem[]): SpatialBounds {
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

  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    rangeX: maxX - minX || 1,
    rangeY: maxY - minY || 1,
    rangeZ: maxZ - minZ || 1,
  }
}

export function normalizeSpatialSystems(
  systems: MapSystem[],
  scale = DEFAULT_SPATIAL_SCALE
) {
  if (systems.length === 0) return []

  const bounds = getSpatialBounds(systems)

  return systems.map((system) => ({
    ...system,
    position: [
      ((system.location.x - bounds.minX) / bounds.rangeX - 0.5) * scale,
      ((system.location.y - bounds.minY) / bounds.rangeY - 0.5) * scale,
      ((system.location.z - bounds.minZ) / bounds.rangeZ - 0.5) * scale,
    ] as [number, number, number],
  }))
}

export function projectNormalizedPositionTo2D(
  position: [number, number, number],
  {
    yaw = DEFAULT_PROJECTION_YAW,
    pitch = DEFAULT_PROJECTION_PITCH,
  }: {
    yaw?: number
    pitch?: number
  } = {}
) {
  const [x, y, z] = position

  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)
  const rotatedX = x * cosYaw + z * sinYaw
  const rotatedZ = -x * sinYaw + z * cosYaw

  const cosPitch = Math.cos(pitch)
  const sinPitch = Math.sin(pitch)
  const rotatedY = y * cosPitch - rotatedZ * sinPitch

  return {
    x: rotatedX,
    y: rotatedY,
  }
}

export function projectSpatialSystemsToViewport(
  systems: MapSystem[],
  { width, height, padding }: ViewportProjectionOptions
) {
  const normalizedSystems = normalizeSpatialSystems(systems)

  if (normalizedSystems.length === 0) return []

  let minProjectedX = Infinity
  let maxProjectedX = -Infinity
  let minProjectedY = Infinity
  let maxProjectedY = -Infinity

  for (const system of normalizedSystems) {
    const { x, y } = projectNormalizedPositionTo2D(system.position)

    if (x < minProjectedX) minProjectedX = x
    if (x > maxProjectedX) maxProjectedX = x
    if (y < minProjectedY) minProjectedY = y
    if (y > maxProjectedY) maxProjectedY = y
  }

  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2
  const spanX = maxProjectedX - minProjectedX || 1
  const spanY = maxProjectedY - minProjectedY || 1
  const viewportScale = Math.min(usableWidth / spanX, usableHeight / spanY)
  const centerX = (minProjectedX + maxProjectedX) / 2
  const centerY = (minProjectedY + maxProjectedY) / 2

  return normalizedSystems.map((system) => {
    const { x, y } = projectNormalizedPositionTo2D(system.position)

    return {
      ...system,
      px: width / 2 + (x - centerX) * viewportScale,
      py: height / 2 - (y - centerY) * viewportScale,
    }
  })
}
