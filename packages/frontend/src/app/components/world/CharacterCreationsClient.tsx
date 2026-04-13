'use client'

import Link from 'next/link'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Orbit, Search, UserRound } from 'lucide-react'
import { DetailEmpty, DetailError, DetailSkeleton } from './IndexerDetailStates'

type CharacterCreationItem = {
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

type CharacterCreationResponse = {
  items: CharacterCreationItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
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
}

type CharacterUserSearchResponse = {
  profiles?: CharacterUserProfile[]
  error?: string
}

function buildCharacterUserDetailHref({
  walletAddress,
  username,
  userId,
  tenant,
}: {
  walletAddress?: string | null
  username?: string | null
  userId?: string | null
  tenant?: string | null
}) {
  const params = new URLSearchParams()

  if (walletAddress) {
    params.set('walletAddress', walletAddress)
  }

  if (username) {
    params.set('username', username)
  }

  if (userId) {
    params.set('userId', userId)
  }

  if (tenant) {
    params.set('tenant', tenant)
  }

  const query = params.toString()
  return query ? `/indexer/character-users?${query}` : null
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

type CharacterCreationsClientProps = {
  variant?: 'page' | 'panel'
}

async function parseJsonResponse<TPayload>(response: Response): Promise<TPayload> {
  const payload = (await response.json().catch(() => ({}))) as TPayload

  if (!response.ok) {
    throw new Error(
      typeof (payload as { error?: string })?.error === 'string'
        ? (payload as { error: string }).error
        : `Request failed: ${response.status}`
    )
  }

  return payload
}

export default function CharacterCreationsClient({
  variant = 'page',
}: CharacterCreationsClientProps) {
  const [page, setPage] = useState(1)
  const [payload, setPayload] = useState<CharacterCreationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CharacterUserProfile[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchHint, setSearchHint] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const isPanel = variant === 'panel'

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/indexer/character-creations?page=${page}&pageSize=20`,
        { cache: 'no-store' }
      )
      const nextPayload = (await response.json().catch(() => ({}))) as
        | CharacterCreationResponse
        | { error?: string }

      if (!response.ok) {
        throw new Error(
          'error' in nextPayload && nextPayload.error
            ? nextPayload.error
            : 'Failed to load Players'
        )
      }

      setPayload(nextPayload as CharacterCreationResponse)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load Players'
      )
    } finally {
      setIsLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const items = useMemo(() => payload?.items ?? [], [payload])
  const latestTime = items[0]?.transactionTime ?? null
  const uniqueWalletCount = useMemo(
    () => new Set(items.map((item) => item.walletAddress).filter(Boolean)).size,
    [items]
  )

  const handleSearch = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault()

      const trimmedQuery = searchQuery.trim()
      if (!trimmedQuery) {
        setSearchError(null)
        setSearchHint('Enter a username, wallet address, or user ID.')
        setSearchResults([])
        return
      }

      setSearchError(null)
      setSearchHint(null)
      setIsSearching(true)

      try {
        const response = await fetch(
          `/api/indexer/character-users?q=${encodeURIComponent(trimmedQuery)}`,
          { cache: 'no-store' }
        )

        const nextPayload = await parseJsonResponse<CharacterUserSearchResponse>(response)
        const profiles = nextPayload.profiles ?? []
        setSearchResults(profiles)
        setSearchHint(
          profiles.length === 0 ? 'No indexed character user matched that query.' : null
        )
      } catch (loadError) {
        setSearchError(
          loadError instanceof Error ? loadError.message : 'Failed to search character users'
        )
      } finally {
        setIsSearching(false)
      }
    },
    [searchQuery]
  )

  const shellClassName = isPanel
    ? 'flex w-full flex-col gap-6'
    : 'mx-auto flex w-full max-w-6xl flex-col gap-6 px-3'
  const headerTitleClassName = isPanel
    ? 'mt-4 text-2xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white sm:text-3xl'
    : 'mt-4 text-2xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-white sm:text-4xl'

  if (isLoading) {
    return <DetailSkeleton title="Players" subtitle="Recent creators" />
  }

  if (error) {
    return (
      <section className={shellClassName}>
        <DetailError title="Failed To Load Players" message={error} onRetry={load} />
      </section>
    )
  }

  if (!payload || items.length === 0) {
    return (
      <section className={shellClassName}>
        <article className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.9))]">
          <div className="font-display inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
            <Search className="h-3.5 w-3.5" />
            Players
          </div>
          <h1 className={headerTitleClassName}>
            character::create_character
          </h1>
        </article>
        <DetailEmpty
          title="No Players indexed yet"
          message="The indexer has not stored any create_character move calls yet."
        />
      </section>
    )
  }

  return (
    <section className={shellClassName}>
      <article className="relative overflow-hidden rounded-[2.4rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.18),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-6 shadow-[0_30px_100px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.12),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.9))]">
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-display inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
                <Orbit className="h-3.5 w-3.5" />
                Players
              </div>
              <h1 className={headerTitleClassName}>
                character::create_character
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                Structured records decoded from `suiscan_move_calls` and the source programmable
                transaction inputs. Click a wallet address to open its indexed history.
              </p>
            </div>
            {!isPanel ? (
              <Link
                href="/"
                className="font-display inline-flex items-center rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-700 transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
              >
                Back home
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/78 p-4 dark:border-slate-800 dark:bg-slate-950/45">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Total Creations
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                {payload.pagination.total}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/78 p-4 dark:border-slate-800 dark:bg-slate-950/45">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Unique Wallets On Page
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                {uniqueWalletCount}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/78 p-4 dark:border-slate-800 dark:bg-slate-950/45">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Latest Creation
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {formatDate(latestTime)}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/78 p-4 dark:border-slate-800 dark:bg-slate-950/45">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Current Page
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                {payload.pagination.page} / {payload.pagination.totalPages}
              </div>
            </div>
          </div>
        </div>
      </article>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/85 dark:border-slate-800 dark:bg-slate-950/55">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                User Search
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Search by username, wallet address, or user ID using the indexed character user API.
              </p>
            </div>
            <div className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Public search
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleSearch}>
            <label className="sr-only" htmlFor="character-user-search">
              Search indexed character users
            </label>
            <input
              id="character-user-search"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="username / wallet / user id"
              className="min-w-0 flex-1 rounded-[1rem] border border-slate-300/80 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950/60 dark:text-white dark:focus:border-sky-600 dark:focus:ring-sky-900/60"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex items-center justify-center gap-2 rounded-[1rem] border border-sky-300/80 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:bg-sky-950/45 dark:text-sky-200"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search user
            </button>
          </form>

          {searchError ? (
            <div className="mt-4 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
              {searchError}
            </div>
          ) : null}

          {searchHint ? (
            <div className="mt-4 rounded-[1rem] border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
              {searchHint}
            </div>
          ) : null}

          {searchResults.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-200/80 text-left dark:border-slate-800">
                    <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">User</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">Wallet</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">Tenant</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">Tribe</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">Creations</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((profile) => (
                    <tr
                      key={`${profile.userId ?? 'unknown'}:${profile.walletAddress ?? 'unknown'}:${profile.tenant ?? 'unknown'}`}
                      className="border-b border-slate-200/70 align-top dark:border-slate-800"
                    >
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-950 dark:text-white">
                          {buildCharacterUserDetailHref(profile) ? (
                            <Link
                              href={buildCharacterUserDetailHref(profile) ?? '#'}
                              className={
                                profile.username
                                  ? 'rounded-full bg-fuchsia-100/90 px-2.5 py-1 text-fuchsia-800 ring-1 ring-fuchsia-300/70 transition hover:bg-fuchsia-200/90 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-800/70 dark:hover:bg-fuchsia-900/60'
                                  : 'transition hover:text-sky-700 hover:underline dark:hover:text-sky-300'
                              }
                            >
                              {profile.username ?? 'Unknown'}
                            </Link>
                          ) : (
                            <span
                              className={
                                profile.username
                                  ? 'rounded-full bg-fuchsia-100/90 px-2.5 py-1 text-fuchsia-800 ring-1 ring-fuchsia-300/70 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-800/70'
                                  : ''
                              }
                            >
                              {profile.username ?? 'Unknown'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          user_id {profile.userId ?? 'unknown'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {profile.walletAddress ? (
                          <Link
                            href={`/history/${encodeURIComponent(profile.walletAddress)}`}
                            className="font-mono text-sm text-sky-700 hover:underline dark:text-sky-300"
                          >
                            {truncateValue(profile.walletAddress)}
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            Unknown
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">
                        {profile.tenant ?? 'Unknown'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">
                        {profile.tribeId ?? 'Unknown'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">
                        {profile.creationCount}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">
                        {formatDate(profile.lastCreatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/85 dark:border-slate-800 dark:bg-slate-950/55">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
            Creator List
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-200/80 text-left dark:border-slate-800">
                <th className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">User</th>
                <th className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">Wallet</th>
                <th className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">Tenant</th>
                <th className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">Tribe</th>
                <th className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">Created</th>
                <th className="px-5 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">Move Call</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-200/70 align-top dark:border-slate-800"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="font-semibold text-slate-950 dark:text-white">
                          {buildCharacterUserDetailHref(item) ? (
                            <Link
                              href={buildCharacterUserDetailHref(item) ?? '#'}
                              className={
                                item.username
                                  ? 'rounded-full bg-fuchsia-100/90 px-2.5 py-1 text-fuchsia-800 ring-1 ring-fuchsia-300/70 transition hover:bg-fuchsia-200/90 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-800/70 dark:hover:bg-fuchsia-900/60'
                                  : 'transition hover:text-sky-700 hover:underline dark:hover:text-sky-300'
                              }
                            >
                              {item.username ?? 'Unknown'}
                            </Link>
                          ) : (
                            <span
                              className={
                                item.username
                                  ? 'rounded-full bg-fuchsia-100/90 px-2.5 py-1 text-fuchsia-800 ring-1 ring-fuchsia-300/70 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-800/70'
                                  : ''
                              }
                            >
                              {item.username ?? 'Unknown'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          user_id {item.userId ?? 'unknown'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {item.walletAddress ? (
                      <Link
                        href={`/history/${encodeURIComponent(item.walletAddress)}`}
                        className="font-mono text-sm text-sky-700 hover:underline dark:text-sky-300"
                      >
                        {truncateValue(item.walletAddress)}
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-500 dark:text-slate-400">Unknown</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
                    {item.tenant ?? 'Unknown'}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
                    {item.tribeId ?? 'Unknown'}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
                    {formatDate(item.transactionTime)}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/indexer/move-calls/${encodeURIComponent(item.txDigest)}/${encodeURIComponent(String(item.callIndex ?? 0))}`}
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

        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
          >
            Previous
          </button>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Page {page} of {payload.pagination.totalPages}
          </div>
          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.min(payload.pagination.totalPages, current + 1))
            }
            disabled={page >= payload.pagination.totalPages}
            className="rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
          >
            Next
          </button>
        </div>
      </section>
    </section>
  )
}
