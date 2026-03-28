'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Clock3, Layers3, Orbit, Search } from 'lucide-react'
import { DetailEmpty, DetailError, DetailSkeleton } from './IndexerDetailStates'

type ActivityParticipant = {
  id: string
  role: string
  tenant: string | null
  characterItemId: string | null
  characterObjectId: string | null
  walletAddress: string | null
  username: string | null
  resolvedVia: string | null
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
  walletAddress: string | null
  username: string | null
  characterItemId: string | null
  characterObjectId: string | null
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

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function truncateValue(value: string, start = 14, end = 10) {
  if (value.length <= start + end + 3) {
    return value
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`
}

function classifyMatch(items: UserActivity[], address: string) {
  let hasWalletMatch = false
  let hasObjectMatch = false

  for (const item of items) {
    for (const participant of item.participants) {
      if (participant.walletAddress === address) {
        hasWalletMatch = true
      }
      if (participant.characterObjectId === address) {
        hasObjectMatch = true
      }
    }
  }

  if (hasWalletMatch && hasObjectMatch) {
    return 'Wallet + Object'
  }
  if (hasWalletMatch) {
    return 'Wallet'
  }
  if (hasObjectMatch) {
    return 'Object'
  }

  return 'Address'
}

function buildParticipantSummary(participants: ActivityParticipant[], address: string) {
  const matches = participants.filter(
    (participant) =>
      participant.walletAddress === address || participant.characterObjectId === address
  )

  if (matches.length === 0) {
    return 'No explicit participant match'
  }

  return matches
    .map((participant) => `${participant.role.replaceAll('_', ' ')}`)
    .join(' • ')
}

function formatParticipantChip(participant: ActivityParticipant) {
  return (
    participant.username ??
    participant.walletAddress ??
    participant.characterItemId ??
    participant.characterObjectId ??
    'unknown'
  )
}

export default function AddressHistoryClient({ address }: { address: string }) {
  const [page, setPage] = useState(1)
  const [payload, setPayload] = useState<UserActivityResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const normalizedAddress = address.toLowerCase()

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/indexer/user-activities?address=${encodeURIComponent(normalizedAddress)}&page=${page}&pageSize=20`,
        { cache: 'no-store' }
      )
      const nextPayload = (await response.json().catch(() => ({}))) as
        | UserActivityResponse
        | { error?: string }

      if (!response.ok) {
        throw new Error(
          'error' in nextPayload && nextPayload.error
            ? nextPayload.error
            : 'Failed to load address history'
        )
      }

      setPayload(nextPayload as UserActivityResponse)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load address history'
      )
    } finally {
      setIsLoading(false)
    }
  }, [normalizedAddress, page])

  useEffect(() => {
    void load()
  }, [load])

  const items = payload?.items ?? []
  const groupedItems = useMemo(() => {
    const groups = []
    let currentLabel = ''
    let currentItems: UserActivity[] = []

    for (const item of items) {
      const label = formatDayLabel(item.activityTime)

      if (label !== currentLabel) {
        if (currentItems.length > 0) {
          groups.push({ label: currentLabel, items: currentItems })
        }
        currentLabel = label
        currentItems = [item]
      } else {
        currentItems.push(item)
      }
    }

    if (currentItems.length > 0) {
      groups.push({ label: currentLabel, items: currentItems })
    }

    return groups
  }, [items])

  const matchType = classifyMatch(items, normalizedAddress)
  const latestTime = items[0]?.activityTime ?? null
  const oldestTime = items.at(-1)?.activityTime ?? null

  if (isLoading) {
    return <DetailSkeleton title="Address History" subtitle="Recent activity" />
  }

  if (error) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
        <DetailError title="Failed To Load Address History" message={error} onRetry={load} />
      </section>
    )
  }

  if (!payload || items.length === 0) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
        <article className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.9))]">
          <div className="font-display inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
            <Search className="h-3.5 w-3.5" />
            Address History
          </div>
          <h1 className="mt-4 break-all font-mono text-2xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white sm:text-4xl">
            {normalizedAddress}
          </h1>
        </article>
        <DetailEmpty
          title="No indexed activity yet"
          message="This address has no resolved activity records yet. It may need another user-activity sync pass or the address may not be represented in current package events."
        />
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
      <article className="relative overflow-hidden rounded-[2.4rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.18),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-6 shadow-[0_30px_100px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.12),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.9))]">
        <div className="absolute -right-20 top-8 h-40 w-40 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/15" />
        <div className="absolute bottom-0 left-0 h-36 w-36 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-500/10" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-display inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
                <Orbit className="h-3.5 w-3.5" />
                Address History
              </div>
              <h1 className="mt-4 break-all font-mono text-2xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-white sm:text-4xl">
                {normalizedAddress}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                A unified activity stream resolved from package events, parsed Move calls,
                and character identity history. Entries are ordered newest first.
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
                Match Type
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                {matchType}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/78 p-4 dark:border-slate-800 dark:bg-slate-950/45">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Activity Count
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                {payload.pagination.total}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/78 p-4 dark:border-slate-800 dark:bg-slate-950/45">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Latest Seen
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {formatDate(latestTime)}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/78 p-4 dark:border-slate-800 dark:bg-slate-950/45">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Oldest On Page
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {formatDate(oldestTime)}
              </div>
            </div>
          </div>
        </div>
      </article>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.88))] shadow-[0_24px_90px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(15,23,42,0.86))]">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                Event Flow
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Resolved and ordered from latest to earliest activity.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
              <Clock3 className="h-3.5 w-3.5" />
              Page {payload.pagination.page} / {payload.pagination.totalPages}
            </div>
          </div>
        </div>

        <div className="space-y-8 px-5 py-6">
          {groupedItems.map((group) => (
            <div key={group.label}>
              <div className="sticky top-24 z-10 mb-4 inline-flex rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-500 backdrop-blur dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-300">
                {group.label}
              </div>
              <div className="space-y-4">
                {group.items.map((item) => (
                  <article
                    key={item.id}
                    className="grid gap-4 rounded-[1.6rem] border border-slate-200/80 bg-white/82 p-5 transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(14,165,233,0.12)] dark:border-slate-800 dark:bg-slate-950/48 dark:hover:shadow-[0_22px_50px_rgba(2,6,23,0.3)] md:grid-cols-[10.5rem_minmax(0,1fr)]"
                  >
                    <div>
                      <div className="font-data text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        {formatDate(item.activityTime)}
                      </div>
                      <div className="mt-3 inline-flex rounded-full border border-sky-200/80 bg-sky-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
                        {item.activityType.replaceAll('_', ' ')}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-display text-xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                            {item.moduleName ?? 'unknown'}::{item.functionName ?? item.activityType}
                          </h3>
                          {item.username ? (
                            <div className="mt-2">
                              <span className="inline-flex rounded-full border border-fuchsia-300/80 bg-fuchsia-100/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-800 dark:border-fuchsia-800/80 dark:bg-fuchsia-950/40 dark:text-fuchsia-200">
                                {item.username}
                              </span>
                            </div>
                          ) : null}
                          <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                            {item.summary}
                          </p>
                        </div>
                        <a
                          href={`/indexer/transaction-blocks/${encodeURIComponent(item.txDigest)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
                        >
                          Open tx
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full border border-amber-200/80 bg-amber-50/90 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-200">
                          {buildParticipantSummary(item.participants, normalizedAddress)}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200/80 bg-slate-100/90 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                          {item.sourceKind}
                        </span>
                        {item.tenant ? (
                          <span className="inline-flex rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-200">
                            {item.tenant}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
                        <div className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/45">
                          <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                            Participants
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.participants.map((participant) => {
                              const chipAddress =
                                participant.walletAddress ?? participant.characterObjectId

                              return (
                                <Link
                                  key={participant.id}
                                  href={chipAddress ? `/history/${encodeURIComponent(chipAddress)}` : '#'}
                                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                    chipAddress === normalizedAddress
                                      ? 'border-sky-300/80 bg-sky-100/90 text-sky-900 dark:border-sky-800 dark:bg-sky-950/45 dark:text-sky-100'
                                      : 'border-slate-200/80 bg-white/85 text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950/55 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300'
                                  }`}
                                >
                                  <span className="uppercase tracking-[0.18em] opacity-70">
                                    {participant.role.replaceAll('_', ' ')}
                                  </span>
                                  <span
                                    className={
                                      participant.username
                                        ? 'rounded-full bg-fuchsia-100/90 px-2 py-0.5 text-fuchsia-800 ring-1 ring-fuchsia-300/70 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:ring-fuchsia-800/70'
                                        : 'font-mono'
                                    }
                                  >
                                    {participant.username
                                      ? formatParticipantChip(participant)
                                      : truncateValue(
                                          chipAddress ?? participant.characterItemId ?? 'unknown'
                                        )}
                                  </span>
                                </Link>
                              )
                            })}
                          </div>
                        </div>

                        <div className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/45">
                          <div className="font-display inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                            <Layers3 className="h-3.5 w-3.5" />
                            Source References
                          </div>
                          <dl className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                            <div>
                              <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                Tx Digest
                              </dt>
                              <dd className="mt-1 font-mono">{truncateValue(item.txDigest)}</dd>
                            </div>
                            {item.eventSeq ? (
                              <div>
                                <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                  Event Seq
                                </dt>
                                <dd className="mt-1 font-mono">{item.eventSeq}</dd>
                              </div>
                            ) : null}
                            {item.callIndex != null ? (
                              <div>
                                <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                  Call Index
                                </dt>
                                <dd className="mt-1 font-mono">{item.callIndex}</dd>
                              </div>
                            ) : null}
                          </dl>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Showing {items.length} items on this page, {payload.pagination.total} in total.
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
                    Math.min(payload.pagination.totalPages, current + 1)
                  )
                }
                disabled={page >= payload.pagination.totalPages}
                className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
              >
                Older
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  )
}
