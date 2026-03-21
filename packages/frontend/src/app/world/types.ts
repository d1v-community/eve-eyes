import type { Constellation, SolarSystem } from './api'

export type MapSystem = SolarSystem

export type SearchSystem = Pick<
  SolarSystem,
  'id' | 'name' | 'constellationId' | 'regionId'
>

export type MapConstellation = Constellation

export type MapLink = {
  fromId: number
  toId: number
  toConstellationId: number
}

export type AtlasGateDestination = SearchSystem

export type AtlasDetailedGateLink = {
  id: number
  name: string
  destination: AtlasGateDestination
}

export type AtlasDetailedSolarSystem = MapSystem & {
  gateLinks: AtlasDetailedGateLink[]
}
