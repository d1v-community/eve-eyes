'use client'

import { useCallback, useEffect, useState } from 'react'
import { JsonCodeBlock } from './JsonCodeBlock'
import { DetailEmpty, DetailError, DetailSkeleton } from './IndexerDetailStates'
import { ParsedActionSummary, type ActionEntity } from './ParsedActionSummary'

type TransactionBlockDetail = {
  digest: string
  senderAddress: string | null
  status: string | null
  transactionTime: string | null
  rawContent: unknown
  effects: unknown
  events: unknown
}

type MoveCallListItem = {
  id: string
  txDigest: string
  callIndex: number | null
  moduleName: string | null
  functionName: string | null
  actionSummary?: string | null
  actionEntities?: ActionEntity[] | null
}

function truncateValue(value: string | null, start = 16, end = 14) {
  if (!value) {
    return 'Unavailable'
  }

  if (value.length <= start + end + 3) {
    return value
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 break-all font-mono text-sm text-slate-950 dark:text-white">
        {value}
      </div>
    </div>
  )
}

function JsonCard({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/85 dark:border-slate-800 dark:bg-slate-950/55">
      <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
        <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
          {title}
        </h2>
      </div>
      <JsonCodeBlock value={value} className="max-h-[36rem] rounded-none border-0 p-5" />
    </section>
  )
}

export default function TransactionBlockDetailClient({ digest }: { digest: string }) {
  const [transaction, setTransaction] = useState<TransactionBlockDetail | null>(null)
  const [moveCalls, setMoveCalls] = useState<MoveCallListItem[] | null>(null)
  const [isTransactionLoading, setIsTransactionLoading] = useState(true)
  const [isMoveCallsLoading, setIsMoveCallsLoading] = useState(true)
  const [transactionError, setTransactionError] = useState<string | null>(null)
  const [moveCallsError, setMoveCallsError] = useState<string | null>(null)

  const loadTransaction = useCallback(async () => {
    setIsTransactionLoading(true)
    setTransactionError(null)

    try {
      const response = await fetch(
        `/api/indexer/transaction-blocks/${encodeURIComponent(digest)}`,
        { cache: 'no-store' }
      )
      const payload = (await response.json().catch(() => ({}))) as {
        item?: TransactionBlockDetail
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load transaction block')
      }

      setTransaction(payload.item ?? null)
    } catch (loadError) {
      setTransactionError(
        loadError instanceof Error ? loadError.message : 'Failed to load transaction block'
      )
    } finally {
      setIsTransactionLoading(false)
    }
  }, [digest])

  const loadMoveCalls = useCallback(async () => {
    setIsMoveCallsLoading(true)
    setMoveCallsError(null)

    try {
      const response = await fetch(
        `/api/indexer/transaction-blocks/${encodeURIComponent(digest)}/move-calls?includeActionSummary=1`,
        { cache: 'no-store' }
      )
      const payload = (await response.json().catch(() => ({}))) as {
        items?: MoveCallListItem[]
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load parsed move calls')
      }

      setMoveCalls(payload.items ?? [])
    } catch (loadError) {
      setMoveCallsError(
        loadError instanceof Error ? loadError.message : 'Failed to load parsed move calls'
      )
    } finally {
      setIsMoveCallsLoading(false)
    }
  }, [digest])

  useEffect(() => {
    void loadTransaction()
    void loadMoveCalls()
  }, [loadTransaction, loadMoveCalls])

  if (isTransactionLoading) {
    return <DetailSkeleton title="Transaction Block" subtitle="Parsed Move Calls" />
  }

  if (transactionError) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
        <DetailError
          title="Failed To Load Transaction"
          message={transactionError}
          onRetry={loadTransaction}
        />
      </section>
    )
  }

  if (!transaction) {
    return (
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
        <DetailEmpty
          title="Transaction Not Found"
          message="This transaction block could not be found. It may not be indexed yet or the digest is invalid."
        />
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
      <article className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.92))] p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.88))]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-display inline-flex rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
              Transaction Block
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              {truncateValue(transaction.digest)}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              This page opens immediately in a new tab, then loads the transaction summary and parsed move calls asynchronously.
            </p>
          </div>
          <a
            href="/#overview"
            className="font-display inline-flex items-center rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
          >
            Back to Overview
          </a>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Digest" value={transaction.digest} />
          <Stat label="Sender" value={transaction.senderAddress ?? 'Unknown'} />
          <Stat label="Status" value={transaction.status ?? 'Unknown'} />
          <Stat label="Time" value={formatDate(transaction.transactionTime)} />
        </div>
      </article>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/85 dark:border-slate-800 dark:bg-slate-950/55">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
              Parsed Move Calls
            </h2>
            <button
              type="button"
              onClick={() => void loadMoveCalls()}
              className="font-display inline-flex rounded-full border border-slate-300/80 bg-white/80 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-slate-700 transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
            >
              Refresh parsed calls
            </button>
          </div>
        </div>

        {isMoveCallsLoading ? (
          <div className="space-y-3 px-5 py-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`parsed-move-call-loading-${index}`}
                className="h-16 animate-pulse rounded-[1rem] bg-slate-100/90 dark:bg-slate-900/80"
              />
            ))}
          </div>
        ) : moveCallsError ? (
          <div className="px-5 py-5">
            <DetailError
              title="Failed To Load Parsed Move Calls"
              message={moveCallsError}
              retryLabel="Retry parsed calls"
              onRetry={() => void loadMoveCalls()}
            />
          </div>
        ) : moveCalls && moveCalls.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50/90 dark:bg-slate-950/90">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    Call
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    Target
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {moveCalls.map((moveCall) => (
                  <tr
                    key={moveCall.id}
                    className="border-b border-slate-200/70 transition-colors hover:bg-sky-50/70 dark:border-slate-800 dark:hover:bg-slate-900/80"
                  >
                    <td className="px-4 py-4 font-mono text-sm text-slate-700 dark:text-slate-200">
                      <a
                        href={`/indexer/move-calls/${encodeURIComponent(moveCall.txDigest)}/${encodeURIComponent(String(moveCall.callIndex ?? 0))}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-slate-300 underline-offset-4 hover:text-sky-700 dark:hover:text-sky-300"
                      >
                        #{moveCall.callIndex ?? '--'}
                      </a>
                    </td>
                    <td className="px-4 py-4 font-mono text-sm text-slate-700 dark:text-slate-200">
                      {moveCall.moduleName ?? 'unknown'}::{moveCall.functionName ?? 'unknown'}
                    </td>
                    <td className="px-4 py-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
                      <ParsedActionSummary
                        summary={moveCall.actionSummary}
                        entities={moveCall.actionEntities}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-10 text-sm text-slate-500 dark:text-slate-400">
            No move calls were indexed for this transaction.
          </div>
        )}
      </section>

      <JsonCard title="Raw Content" value={transaction.rawContent} />
      <JsonCard title="Effects" value={transaction.effects} />
      <JsonCard title="Events" value={transaction.events} />
    </section>
  )
}
