'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRight, CalendarRange, Filter, Orbit, Search } from 'lucide-react'
import { DetailEmpty, DetailError, DetailSkeleton } from './IndexerDetailStates'

type ActivityParticipant = {
  id: string
  role: string
  tenant: string | null
  characterItemId: string | null
  characterObjectId: string | null
  walletAddress: string | null
  username?: string | null
}

type UserActivity = {
  id: string
  tenant: string | null
  txDigest: string
  eventSeq: string | null
  callIndex: number | null
  activityTime: string
  activityType: string
  moduleName: string | null
  functionName: string | null
  sourceKind: string
  summary: string
  username?: string | null
  participants: ActivityParticipant[]
}

type UserActivityResponse = {
  items: UserActivity[]
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
    timeStyle: 'medium',
  }).format(new Date(value))
}

function truncateValue(value: string, start = 14, end = 10) {
  if (value.length <= start + end + 3) {
    return value
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`
}

export default function ActivityExplorerClient() {
  const [query, setQuery] = useState('')
  const [activityType, setActivityType] = useState('')
  const [sourceKind, setSourceKind] = useState('')
  const [page, setPage] = useState(1)
  const [payload, setPayload] = useState<UserActivityResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const deferredActivityType = useDeferredValue(activityType)
  const deferredSourceKind = useDeferredValue(sourceKind)

  useEffect(() => {
    setPage(1)
  }, [deferredQuery, deferredActivityType, deferredSourceKind])

  useEffect(() => {
    let ignore = false

    async function load() {
      setIsLoading(true)
      setError(null)

      try {
        const searchParams = new URLSearchParams({
          page: String(page),
          pageSize: '20',
        })

        if (deferredQuery) {
          searchParams.set('address', deferredQuery)
        }
        if (deferredActivityType) {
          searchParams.set('activityType', deferredActivityType)
        }
        if (deferredSourceKind) {
          searchParams.set('sourceKind', deferredSourceKind)
        }

        const response = await fetch(`/api/indexer/user-activities?${searchParams.toString()}`, {
          cache: 'no-store',
        })
        const nextPayload = (await response.json().catch(() => ({}))) as
          | UserActivityResponse
          | { error?: string }

        if (!response.ok) {
          throw new Error(
            'error' in nextPayload && nextPayload.error
              ? nextPayload.error
              : 'Failed to load activity explorer'
          )
        }

        if (!ignore) {
          setPayload(nextPayload as UserActivityResponse)
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error ? loadError.message : 'Failed to load activity explorer'
          )
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      ignore = true
    }
  }, [deferredActivityType, deferredQuery, deferredSourceKind, page])

  const items = payload?.items ?? []
  const featuredParticipants = useMemo(() => {
    const values = new Map<string, { href: string; label: string }>()

    for (const item of items) {
      for (const participant of item.participants) {
        const address = participant.walletAddress ?? participant.characterObjectId

        if (!address || values.has(address)) {
          continue
        }

        values.set(address, {
          href: `/history/${encodeURIComponent(address)}`,
          label: participant.role.replaceAll('_', ' '),
        })
      }
    }

    return [...values.entries()].slice(0, 8)
  }, [items])

  if (isLoading && !payload) {
    return <DetailSkeleton title="Activity Explorer" subtitle="Unified event flow" />
  }

  if (error) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
        <DetailError title="Failed To Load Activity Explorer" message={error} />
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
      <article className="overflow-hidden rounded-[2.4rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(14,165,233,0.18),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-6 shadow-[0_30px_100px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(56,189,248,0.18),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.9))]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-display inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-200">
              <Activity className="h-3.5 w-3.5" />
              Activity Explorer
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
              Browse the full on-chain behavior stream
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              Filter the derived user-activity index by address, behavior type, and
              source. Every result links back into the address history surface.
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/45">
            <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Total indexed activities
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              {payload?.pagination.total ?? 0}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_13rem_13rem]">
          <label className="rounded-[1.25rem] border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/45">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              <Search className="h-3.5 w-3.5" />
              Address filter
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="wallet or object address"
              className="w-full bg-transparent font-mono text-sm text-slate-950 outline-none placeholder:text-slate-400 dark:text-white"
            />
          </label>

          <label className="rounded-[1.25rem] border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/45">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              Activity type
            </div>
            <input
              value={activityType}
              onChange={(event) => setActivityType(event.target.value.trim())}
              placeholder="jump"
              className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 dark:text-white"
            />
          </label>

          <label className="rounded-[1.25rem] border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/45">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              <CalendarRange className="h-3.5 w-3.5" />
              Source kind
            </div>
            <select
              value={sourceKind}
              onChange={(event) => setSourceKind(event.target.value)}
              className="w-full bg-transparent text-sm text-slate-950 outline-none dark:text-white"
            >
              <option value="">All sources</option>
              <option value="event">Event</option>
              <option value="move_call">Move call</option>
              <option value="derived">Derived</option>
            </select>
          </label>
        </div>

        {featuredParticipants.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {featuredParticipants.map(([address, item]) => (
              <Link
                key={address}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950/55 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
              >
                <Orbit className="h-3.5 w-3.5" />
                <span className="uppercase tracking-[0.16em] opacity-70">{item.label}</span>
                <span className="font-mono">{truncateValue(address)}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </article>

      {items.length === 0 ? (
        <DetailEmpty
          title="No activities matched"
          message="Adjust the filters or search for a different address to inspect the unified activity index."
        />
      ) : (
        <section className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-[1.7rem] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/45"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-sky-200/80 bg-sky-50/90 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
                      {item.activityType.replaceAll('_', ' ')}
                    </span>
                    <span className="inline-flex rounded-full border border-slate-200/80 bg-slate-100/90 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                      {item.sourceKind}
                    </span>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                    {item.moduleName ?? 'unknown'}::{item.functionName ?? item.activityType}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {item.summary}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-data text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {formatDate(item.activityTime)}
                  </div>
                  <a
                    href={`/indexer/transaction-blocks/${encodeURIComponent(item.txDigest)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950/55 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
                  >
                    Transaction
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {item.participants.map((participant) => {
                  const address = participant.walletAddress ?? participant.characterObjectId

                  if (!address) {
                    return null
                  }

                  return (
                    <Link
                      key={participant.id}
                      href={`/history/${encodeURIComponent(address)}`}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
                    >
                      <span className="uppercase tracking-[0.16em] opacity-70">
                        {participant.role.replaceAll('_', ' ')}
                      </span>
                      <span className="font-mono">{truncateValue(address)}</span>
                    </Link>
                  )
                })}
              </div>
            </article>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-slate-200/80 bg-white/82 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/45">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Page {payload?.pagination.page ?? 1} of {payload?.pagination.totalPages ?? 1}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
              >
                Newer
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    Math.min(payload?.pagination.totalPages ?? current, current + 1)
                  )
                }
                disabled={page >= (payload?.pagination.totalPages ?? 1)}
                className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
              >
                Older
              </button>
            </div>
          </div>
        </section>
      )}
    </section>
  )
}
