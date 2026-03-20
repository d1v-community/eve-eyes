'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import SystemSearchInput from './SystemSearchInput'

type SystemSearchResult = {
  id: number
  name: string
  constellationId: number
  regionId: number
}

export default function VerifySearchForm() {
  const router = useRouter()
  const [system, setSystem] = useState<SystemSearchResult | null>(null)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()

        if (system != null) {
          router.push(`/verify?systemId=${system.id}`)
        }
      }}
      className="space-y-4"
    >
      <SystemSearchInput
        label="Solar system"
        placeholder="Search a solar system to generate a POD card"
        selected={system}
        onSelect={setSystem}
      />
      <button
        type="submit"
        disabled={system == null}
        className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
      >
        <Search className="h-4 w-4" />
        Generate POD card
      </button>
    </form>
  )
}
