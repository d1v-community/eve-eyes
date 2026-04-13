'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Orbit, UserRound } from 'lucide-react'
import { DetailEmpty, DetailError, DetailSkeleton } from './IndexerDetailStates'

type CharacterCreationRecord = {
  id: string
  txDigest: string
  callIndex: number | null
  transactionTime: string | null
  userId: string | null
  tenant: string | null
  tribeId: string | null
  walletAddress: string | null
  username: string | null
}

type CharacterUserProfile = {
  userId: string | null
  username: string | null
  walletAddress: string | null
  tenant: string | null
  tribeId: string | null
  firstCreatedAt: string | null
  lastCreatedAt: string | null
  creationCount: number
  creations: CharacterCreationRecord[]
}

type CharacterUserDetailResponse = {
  profile?: CharacterUserProfile
  error?: string
}

type CharacterUserDetailClientProps = {
  walletAddress?: string | null
  username?: string | null
  userId?: string | null
  tenant?: string | null
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Pending'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function truncateValue(value: string, start = 12, end = 10) {
  if (value.length <= start + end + 3) {
    return value
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`
}

function parseJsonResponse<TPayload>(response: Response): Promise<TPayload> {
  return response.json().catch(() => ({} as TPayload))
}

export default function CharacterUserDetailClient({
  walletAddress = null,
  username = null,
  userId = null,
  tenant = null,
}: CharacterUserDetailClientProps) {
  const [profile, setProfile] = useState<CharacterUserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()

    if (walletAddress?.trim()) {
      params.set('walletAddress', walletAddress.trim())
    }

    if (username?.trim()) {
      params.set('username', username.trim())
    }

    if (userId?.trim()) {
      params.set('userId', userId.trim())
    }

    if (tenant?.trim()) {
      params.set('tenant', tenant.trim())
    }

    return params.toString()
  }, [tenant, userId, username, walletAddress])

  const load = useCallback(async () => {
    if (!queryString) {
      setProfile(null)
      setError('Missing character user identifier')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/indexer/character-users/detail?${queryString}`, {
        cache: 'no-store',
      })
      const payload = await parseJsonResponse<CharacterUserDetailResponse>(response)

      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : `Request failed: ${response.status}`
        )
      }

      setProfile(payload.profile ?? null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load character user detail'
      )
    } finally {
      setIsLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    void load()
  }, [load])

  if (isLoading) {
    return <DetailSkeleton title="Player Detail" subtitle="Recent creations" />
  }

  if (error) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
        <DetailError title="Failed To Load Player Detail" message={error} onRetry={load} />
      </section>
    )
  }

  if (!profile) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
        <DetailEmpty
          title="Player not found"
          message="No indexed player matched this username or identifier."
        />
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
      <article className="relative overflow-hidden rounded-[2.4rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.18),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-6 shadow-[0_30px_100px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.12),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.9))]">
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-display inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
                <Orbit className="h-3.5 w-3.5" />
                Player Detail
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="font-display text-2xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-white sm:text-4xl">
                    {profile.username ?? 'Unknown'}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    user_id {profile.userId ?? 'unknown'}
                  </p>
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                Indexed from `character::create_character` records and grouped into a single
                player profile.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/indexer/character-creations"
                className="font-display inline-flex items-center rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-700 transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
              >
                Back to Players
              </Link>
              {profile.walletAddress ? (
                <Link
                  href={`/history/${encodeURIComponent(profile.walletAddress)}`}
                  className="font-display inline-flex items-center gap-2 rounded-full border border-sky-300/80 bg-sky-50 px-4 py-2 text-xs uppercase tracking-[0.22em] text-sky-800 transition hover:-translate-y-0.5 dark:border-sky-800 dark:bg-sky-950/45 dark:text-sky-200"
                >
                  Wallet History
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/78 p-4 dark:border-slate-800 dark:bg-slate-950/45">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Total Creations
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                {profile.creationCount}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/78 p-4 dark:border-slate-800 dark:bg-slate-950/45">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Wallet
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {profile.walletAddress ? truncateValue(profile.walletAddress) : 'Unknown'}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/78 p-4 dark:border-slate-800 dark:bg-slate-950/45">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Tenant / Tribe
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {(profile.tenant ?? 'Unknown') + ' / ' + (profile.tribeId ?? 'Unknown')}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/78 p-4 dark:border-slate-800 dark:bg-slate-950/45">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Latest Creation
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {formatDate(profile.lastCreatedAt)}
              </div>
            </div>
          </div>
        </div>
      </article>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/85 dark:border-slate-800 dark:bg-slate-950/55">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
            Creation Timeline
          </h2>
        </div>
        {profile.creations.length === 0 ? (
          <div className="px-5 py-6">
            <DetailEmpty
              title="No creations recorded"
              message="This player profile exists, but there are no indexed character creation rows to display."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200/80 text-left dark:border-slate-800">
                  <th className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Created
                  </th>
                  <th className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Wallet
                  </th>
                  <th className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Tenant
                  </th>
                  <th className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Tribe
                  </th>
                  <th className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Move Call
                  </th>
                </tr>
              </thead>
              <tbody>
                {profile.creations.map((creation) => (
                  <tr
                    key={creation.id}
                    className="border-b border-slate-200/70 align-top dark:border-slate-800"
                  >
                    <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
                      {formatDate(creation.transactionTime)}
                    </td>
                    <td className="px-5 py-4">
                      {creation.walletAddress ? (
                        <Link
                          href={`/history/${encodeURIComponent(creation.walletAddress)}`}
                          className="font-mono text-sm text-sky-700 hover:underline dark:text-sky-300"
                        >
                          {truncateValue(creation.walletAddress)}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          Unknown
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
                      {creation.tenant ?? 'Unknown'}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
                      {creation.tribeId ?? 'Unknown'}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/indexer/move-calls/${encodeURIComponent(creation.txDigest)}/${encodeURIComponent(String(creation.callIndex ?? 0))}`}
                        className="text-sm text-sky-700 hover:underline dark:text-sky-300"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
