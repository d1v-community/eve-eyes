'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { MapSystem, SearchSystem } from '../../world/types'

type UseAtlasQueryStateOptions = {
  allSystemsById: Map<number, MapSystem>
  searchableSystemsById: Map<number, SearchSystem>
  initialOrigin: SearchSystem | null
  initialDestination: SearchSystem | null
}

export function useAtlasQueryState({
  allSystemsById,
  searchableSystemsById,
  initialOrigin,
  initialDestination,
}: UseAtlasQueryStateOptions) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [origin, setOrigin] = useState<SearchSystem | null>(() => {
    const originId = Number(searchParams.get('originId'))
    return Number.isFinite(originId) && searchableSystemsById.has(originId)
      ? searchableSystemsById.get(originId) ?? null
      : initialOrigin
  })
  const [destination, setDestination] = useState<SearchSystem | null>(() => {
    const destinationId = Number(searchParams.get('destinationId'))
    return Number.isFinite(destinationId) && searchableSystemsById.has(destinationId)
      ? searchableSystemsById.get(destinationId) ?? null
      : initialDestination
  })
  const [focusedSystemId, setFocusedSystemId] = useState<number | null>(() => {
    const focusId = Number(searchParams.get('focusId'))
    return Number.isFinite(focusId) && allSystemsById.has(focusId) ? focusId : null
  })
  const [showGateLinks, setShowGateLinks] = useState(
    () => searchParams.get('links') !== '0'
  )
  const [routeOnly, setRouteOnly] = useState(
    () => searchParams.get('view') === 'route'
  )

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())

    if (origin != null) {
      params.set('originId', String(origin.id))
    } else {
      params.delete('originId')
    }

    if (destination != null) {
      params.set('destinationId', String(destination.id))
    } else {
      params.delete('destinationId')
    }

    if (focusedSystemId != null) {
      params.set('focusId', String(focusedSystemId))
    } else {
      params.delete('focusId')
    }

    if (!showGateLinks) {
      params.set('links', '0')
    } else {
      params.delete('links')
    }

    if (routeOnly) {
      params.set('view', 'route')
    } else {
      params.delete('view')
    }

    const nextQuery = params.toString()
    const currentQuery = searchParams.toString()

    if (nextQuery === currentQuery) return

    router.replace(nextQuery.length > 0 ? `?${nextQuery}` : '/atlas', {
      scroll: false,
    })
  }, [
    destination,
    focusedSystemId,
    origin,
    routeOnly,
    router,
    searchParams,
    showGateLinks,
  ])

  return {
    destination,
    focusedSystemId,
    origin,
    routeOnly,
    searchParams,
    setDestination,
    setFocusedSystemId,
    setOrigin,
    setRouteOnly,
    setShowGateLinks,
    showGateLinks,
  }
}
