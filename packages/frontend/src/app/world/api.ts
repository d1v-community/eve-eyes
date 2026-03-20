const WORLD_API_BASE_URL =
  process.env.WORLD_API_BASE_URL ??
  'https://world-api-utopia.uat.pub.evefrontier.com'

const WORLD_API_TOKEN = process.env.WORLD_API_BEARER_TOKEN
const DEFAULT_REVALIDATE_SECONDS = 300

type FetchWorldOptions = {
  auth?: boolean
  method?: 'GET' | 'POST'
  body?: string
  revalidate?: number
}

export type WorldResult<T> = {
  data: T | null
  error: string | null
}

export type PaginationMetadata = {
  total: number
  limit: number
  offset: number
}

export type PaginatedResponse<T> = {
  data: T[]
  metadata: PaginationMetadata
}

export type WorldHealth = {
  ok?: boolean
  message?: string
}

export type WorldConfig = {
  podPublicSigningKey: string
}

export type GameLocation = {
  x: number
  y: number
  z: number
}

export type SolarSystem = {
  id: number
  name: string
  constellationId: number
  regionId: number
  location: GameLocation
}

export type GateLink = {
  id: number
  name: string
  location: GameLocation
  destination: SolarSystem
}

export type DetailedSolarSystem = SolarSystem & {
  gateLinks: GateLink[]
}

export type Constellation = {
  id: number
  name: string
  regionId: number
  location: GameLocation
  solarSystems?: SolarSystem[]
}

export type Ship = {
  id: number
  name: string
  classId: number
  className: string
  description: string
}

export type DetailedShip = Ship & {
  slots: {
    high: number
    medium: number
    low: number
  }
  health: {
    shield: number
    armor: number
    structure: number
  }
  physics: {
    mass: number
    maximumVelocity: number
    inertiaModifier: number
    heat: {
      heatCapacity: number
      conductance: number
    }
  }
  fuelCapacity: number
  cpuOutput: number
  powergridOutput: number
  capacitor: {
    capacity: number
    rechargeRate: number
  }
}

export type GameType = {
  id: number
  name: string
  description: string
  mass: number
  radius: number
  volume: number
  portionSize: number
  groupName: string
  groupId: number
  categoryName: string
  categoryId: number
  iconUrl: string
}

export type Tribe = {
  id: number
  name: string
  nameShort: string
  description: string
  taxRate: number
  tribeUrl: string
}

export type JumpShip = {
  id?: number
  name?: string
  className?: string
}

export type Jump = {
  id: number
  origin: SolarSystem
  destination: SolarSystem
  ship: JumpShip
  time: string
}

export type PodRecord = {
  entries: Record<string, unknown>
  signature: string
  signerPublicKey: string
}

export type PodVerifyResponse = {
  isValid: boolean
  error?: string
}

async function fetchWorld<T>(
  path: string,
  options: FetchWorldOptions = {}
): Promise<WorldResult<T>> {
  const {
    auth = false,
    method = 'GET',
    body,
    revalidate = DEFAULT_REVALIDATE_SECONDS,
  } = options

  if (auth && !WORLD_API_TOKEN) {
    return { data: null, error: 'Missing WORLD_API_BEARER_TOKEN' }
  }

  try {
    const response = await fetch(`${WORLD_API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && WORLD_API_TOKEN
          ? { Authorization: `Bearer ${WORLD_API_TOKEN}` }
          : {}),
      },
      ...(body ? { body } : {}),
      next: { revalidate },
    })

    if (!response.ok) {
      return {
        data: null,
        error: `${response.status} ${response.statusText}`,
      }
    }

    const data = (await response.json()) as T
    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown fetch error',
    }
  }
}

export async function getWorldHealth() {
  return fetchWorld<WorldHealth>('/health')
}

export async function getWorldConfig() {
  return fetchWorld<WorldConfig[]>('/config')
}

export async function listConstellations(limit = 3, offset = 0) {
  return fetchWorld<PaginatedResponse<Constellation>>(
    `/v2/constellations?limit=${limit}&offset=${offset}`
  )
}

export async function getConstellation(id: number) {
  return fetchWorld<Constellation>(`/v2/constellations/${id}`)
}

export async function listSolarSystems(limit = 4, offset = 0) {
  return fetchWorld<PaginatedResponse<SolarSystem>>(
    `/v2/solarsystems?limit=${limit}&offset=${offset}`
  )
}

export async function getSolarSystem(id: number) {
  return fetchWorld<DetailedSolarSystem>(`/v2/solarsystems/${id}`)
}

export async function getSolarSystemPod(id: number) {
  return fetchWorld<PodRecord>(`/v2/solarsystems/${id}?format=pod`)
}

export async function verifyPod(pod: PodRecord) {
  return fetchWorld<PodVerifyResponse>('/v2/pod/verify', {
    method: 'POST',
    body: JSON.stringify(pod),
    revalidate: 0,
  })
}

export async function listShips(limit = 3, offset = 0) {
  return fetchWorld<PaginatedResponse<Ship>>(
    `/v2/ships?limit=${limit}&offset=${offset}`
  )
}

export async function getShip(id: number) {
  return fetchWorld<DetailedShip>(`/v2/ships/${id}`)
}

export async function listTypes(limit = 4, offset = 0) {
  return fetchWorld<PaginatedResponse<GameType>>(
    `/v2/types?limit=${limit}&offset=${offset}`
  )
}

export async function getType(id: number) {
  return fetchWorld<GameType>(`/v2/types/${id}`)
}

export async function listTribes(limit = 3, offset = 0) {
  return fetchWorld<PaginatedResponse<Tribe>>(
    `/v2/tribes?limit=${limit}&offset=${offset}`
  )
}

export async function getTribe(id: number) {
  return fetchWorld<Tribe>(`/v2/tribes/${id}`)
}

export async function listMyJumps(limit = 5, offset = 0) {
  return fetchWorld<PaginatedResponse<Jump>>(
    `/v2/characters/me/jumps?limit=${limit}&offset=${offset}`,
    { auth: true, revalidate: 60 }
  )
}

export async function getMyJump(id: number) {
  return fetchWorld<Jump>(`/v2/characters/me/jumps/${id}`, {
    auth: true,
    revalidate: 60,
  })
}
