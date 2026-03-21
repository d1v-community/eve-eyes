'use client'

import { useEffect, useState } from 'react'
import type { AtlasDetailedSolarSystem, MapSystem } from '../../world/types'

export function useAtlasSystemDetails(selectedSystem: MapSystem | null) {
  const [detailSystem, setDetailSystem] = useState<AtlasDetailedSolarSystem | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  useEffect(() => {
    if (selectedSystem == null) {
      setDetailSystem(null)
      setDetailError(null)
      setIsDetailLoading(false)
      return
    }

    const controller = new AbortController()

    const loadDetails = async () => {
      setIsDetailLoading(true)
      setDetailError(null)

      try {
        const response = await fetch(`/api/world/systems/${selectedSystem.id}`, {
          signal: controller.signal,
        })
        const payload = (await response.json()) as AtlasDetailedSolarSystem & {
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to load system details')
        }

        setDetailSystem(payload)
      } catch (requestError) {
        if ((requestError as Error).name === 'AbortError') return

        setDetailSystem(null)
        setDetailError(
          requestError instanceof Error
            ? requestError.message
            : 'Failed to load system details'
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsDetailLoading(false)
        }
      }
    }

    void loadDetails()

    return () => controller.abort()
  }, [selectedSystem])

  return {
    detailError,
    detailSystem,
    isDetailLoading,
  }
}
