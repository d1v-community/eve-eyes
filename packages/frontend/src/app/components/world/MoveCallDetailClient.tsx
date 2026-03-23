'use client'

import { useCallback, useEffect, useState } from 'react'
import { JsonCodeBlock } from './JsonCodeBlock'
import { DetailEmpty, DetailError, DetailSkeleton } from './IndexerDetailStates'
import { ParsedActionSummary, type ActionEntity } from './ParsedActionSummary'

type MoveCallDetail = {
  txDigest: string
  callIndex: number | null
  moduleName: string | null
  functionName: string | null
  rawCall: unknown
  senderAddress: string | null
  transactionTime: string | null
  actionSummary?: string | null
  actionEntities?: ActionEntity[] | null
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

export default function MoveCallDetailClient({
  txDigest,
  callIndex,
}: {
  txDigest: string
  callIndex: string
}) {
  const [item, setItem] = useState<MoveCallDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/indexer/move-calls/${encodeURIComponent(txDigest)}/${encodeURIComponent(callIndex)}`,
        { cache: 'no-store' }
      )
      const payload = (await response.json().catch(() => ({}))) as {
        item?: MoveCallDetail
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load move call details')
      }

      setItem(payload.item ?? null)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load move call details'
      )
    } finally {
      setIsLoading(false)
    }
  }, [txDigest, callIndex])

  useEffect(() => {
    void load()
  }, [load])

  if (isLoading) {
    return <DetailSkeleton title="Move Call Detail" subtitle="Raw Call" />
  }

  if (error) {
    return (
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-3">
        <DetailError title="Failed To Load Move Call" message={error} onRetry={load} />
      </section>
    )
  }

  if (!item) {
    return (
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-3">
        <DetailEmpty
          title="Move Call Not Found"
          message="This move call could not be found. It may have been removed or the digest/index pair is invalid."
        />
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-3">
      <article className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.92))] p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.88))]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-display inline-flex rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
              Move Call Detail
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              {item.moduleName ?? 'unknown'}::{item.functionName ?? 'unknown'}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              This page loads move call parsing on demand so the overview tables stay fast.
            </p>
          </div>
          <a
            href={`/indexer/transaction-blocks/${encodeURIComponent(item.txDigest)}`}
            target="_blank"
            rel="noreferrer"
            className="font-display inline-flex items-center rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
          >
            Open Transaction
          </a>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Tx Digest" value={item.txDigest} />
          <Stat label="Call Index" value={String(item.callIndex ?? '--')} />
          <Stat label="Sender" value={item.senderAddress ?? 'Unknown'} />
          <Stat label="Time" value={formatDate(item.transactionTime)} />
        </div>

        <div className="mt-5 rounded-[1.4rem] border border-emerald-300/60 bg-emerald-50/85 p-5 text-sm leading-7 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="font-display text-[11px] uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
            Parsed Action
          </div>
          <div className="mt-2">
            <ParsedActionSummary
              summary={item.actionSummary}
              entities={item.actionEntities}
            />
          </div>
        </div>
      </article>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/85 dark:border-slate-800 dark:bg-slate-950/55">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
            Raw Call
          </h2>
        </div>
        <JsonCodeBlock
          value={item.rawCall}
          className="max-h-[36rem] rounded-none border-0 p-5"
        />
      </section>
    </section>
  )
}
