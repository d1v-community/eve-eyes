'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Orbit, Search, UserRound } from 'lucide-react'
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

export default function CharacterCreationsClient() {
  const [page, setPage] = useState(1)
  const [payload, setPayload] = useState<CharacterCreationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
            : 'Failed to load character creations'
        )
      }

      setPayload(nextPayload as CharacterCreationResponse)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load character creations'
      )
    } finally {
      setIsLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const items = payload?.items ?? []
  const latestTime = items[0]?.transactionTime ?? null
  const uniqueWalletCount = useMemo(
    () => new Set(items.map((item) => item.walletAddress).filter(Boolean)).size,
    [items]
  )

  if (isLoading) {
    return <DetailSkeleton title="Character Creations" subtitle="Recent creators" />
  }

  if (error) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
        <DetailError title="Failed To Load Character Creations" message={error} onRetry={load} />
      </section>
    )
  }

  if (!payload || items.length === 0) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
        <article className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.9))]">
          <div className="font-display inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
            <Search className="h-3.5 w-3.5" />
            Character Creations
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white sm:text-4xl">
            character::create_character
          </h1>
        </article>
        <DetailEmpty
          title="No character creations indexed yet"
          message="The indexer has not stored any create_character move calls yet."
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
                Character Creations
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-white sm:text-4xl">
                character::create_character
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                Structured records decoded from `suiscan_move_calls` and the source programmable
                transaction inputs. Click a wallet address to open its indexed history.
              </p>
            </div>
            <Link
              href="/"
              className="font-display inline-flex items-center rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-700 transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
            >
              Back home
            </Link>
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
                          {item.username ?? 'Unknown'}
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
