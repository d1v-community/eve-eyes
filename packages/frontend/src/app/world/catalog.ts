import 'server-only'

import { cache } from 'react'
import { getSolarSystem, listSolarSystems, type SolarSystem } from './api'

export type SystemDirectoryEntry = Pick<
  SolarSystem,
  'id' | 'name' | 'constellationId' | 'regionId' | 'location'
>

export type SystemRouteNode = SystemDirectoryEntry

type RouteSearchResult = {
  path: SystemRouteNode[]
  hops: number
  explored: number
}

const PAGE_SIZE = 1000
const MAX_ROUTE_EXPANSIONS = 1500
const neighborCache = new Map<number, Promise<SystemRouteNode[]>>()

const normalize = (value: string) => value.trim().toLowerCase()

export const getSystemDirectory = cache(async (): Promise<SystemDirectoryEntry[]> => {
  const firstPage = await listSolarSystems(PAGE_SIZE)

  if (firstPage.data == null) {
    throw new Error(firstPage.error ?? 'Failed to load solar systems')
  }

  const total = firstPage.data.metadata.total
  const systems = [...firstPage.data.data]
  const remainingOffsets: number[] = []

  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    remainingOffsets.push(offset)
  }

  const remainingPages = await Promise.all(
    remainingOffsets.map((offset) =>
      listSolarSystems(PAGE_SIZE, offset).then((result) => {
        if (result.data == null) {
          throw new Error(result.error ?? 'Failed to page solar systems')
        }

        return result.data.data
      })
    )
  )

  return systems
    .concat(...remainingPages)
    .sort((left, right) => left.name.localeCompare(right.name))
})

export async function searchSystems(query: string, limit = 8) {
  const normalizedQuery = normalize(query)

  if (normalizedQuery.length < 2) {
    return []
  }

  const systems = await getSystemDirectory()
  const startsWithMatches = systems.filter((system) =>
    normalize(system.name).startsWith(normalizedQuery)
  )
  const containsMatches = systems.filter(
    (system) =>
      !normalize(system.name).startsWith(normalizedQuery) &&
      normalize(system.name).includes(normalizedQuery)
  )

  return [...startsWithMatches, ...containsMatches].slice(0, limit)
}

export async function getSystemById(id: number) {
  const systems = await getSystemDirectory()

  return systems.find((system) => system.id === id) ?? null
}

async function getNeighbors(systemId: number): Promise<SystemRouteNode[]> {
  if (!neighborCache.has(systemId)) {
    neighborCache.set(
      systemId,
      getSolarSystem(systemId).then((result) => {
        if (result.data == null) {
          throw new Error(result.error ?? `Failed to load system ${systemId}`)
        }

        return result.data.gateLinks.map((gate) => ({
          id: gate.destination.id,
          name: gate.destination.name,
          constellationId: gate.destination.constellationId,
          regionId: gate.destination.regionId,
          location: gate.destination.location,
        }))
      })
    )
  }

  return neighborCache.get(systemId)!
}

function buildPath(
  meetingId: number,
  forwardParents: Map<number, number | null>,
  backwardParents: Map<number, number | null>,
  directory: Map<number, SystemDirectoryEntry>
) {
  const forwardPath: number[] = []
  let currentForward: number | null = meetingId

  while (currentForward != null) {
    forwardPath.push(currentForward)
    currentForward = forwardParents.get(currentForward) ?? null
  }

  forwardPath.reverse()

  const backwardPath: number[] = []
  let currentBackward = backwardParents.get(meetingId) ?? null

  while (currentBackward != null) {
    backwardPath.push(currentBackward)
    currentBackward = backwardParents.get(currentBackward) ?? null
  }

  return [...forwardPath, ...backwardPath]
    .map((id) => directory.get(id))
    .filter((system): system is SystemDirectoryEntry => system != null)
    .map((system) => ({
      id: system.id,
      name: system.name,
      constellationId: system.constellationId,
      regionId: system.regionId,
      location: system.location,
    }))
}

export async function findRoute(originId: number, destinationId: number) {
  const systems = await getSystemDirectory()
  const directory = new Map(systems.map((system) => [system.id, system]))

  if (!directory.has(originId) || !directory.has(destinationId)) {
    throw new Error('Origin or destination not found')
  }

  if (originId === destinationId) {
    const system = directory.get(originId)!

    return {
      path: [
        {
          id: system.id,
          name: system.name,
          constellationId: system.constellationId,
          regionId: system.regionId,
          location: system.location,
        },
      ],
      hops: 0,
      explored: 1,
    } satisfies RouteSearchResult
  }

  const forwardParents = new Map<number, number | null>([[originId, null]])
  const backwardParents = new Map<number, number | null>([[destinationId, null]])
  let forwardFrontier = [originId]
  let backwardFrontier = [destinationId]
  let explored = 0

  while (
    forwardFrontier.length > 0 &&
    backwardFrontier.length > 0 &&
    explored < MAX_ROUTE_EXPANSIONS
  ) {
    const expandForward = forwardFrontier.length <= backwardFrontier.length
    const frontier = expandForward ? forwardFrontier : backwardFrontier
    const currentParents = expandForward ? forwardParents : backwardParents
    const otherParents = expandForward ? backwardParents : forwardParents
    const nextFrontier: number[] = []
    const neighborLists = await Promise.all(frontier.map(getNeighbors))

    for (let index = 0; index < frontier.length; index += 1) {
      const currentId = frontier[index]
      const neighbors = neighborLists[index]

      explored += 1

      for (const neighbor of neighbors) {
        if (currentParents.has(neighbor.id)) {
          continue
        }

        currentParents.set(neighbor.id, currentId)

        if (otherParents.has(neighbor.id)) {
          const path = buildPath(
            neighbor.id,
            forwardParents,
            backwardParents,
            directory
          )

          return {
            path,
            hops: Math.max(path.length - 1, 0),
            explored,
          } satisfies RouteSearchResult
        }

        nextFrontier.push(neighbor.id)
      }
    }

    if (expandForward) {
      forwardFrontier = nextFrontier
    } else {
      backwardFrontier = nextFrontier
    }
  }

  throw new Error('No route found within the current search budget')
}
