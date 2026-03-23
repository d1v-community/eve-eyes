import { notFound } from 'next/navigation'
import { JsonCodeBlock } from '~~/components/world/JsonCodeBlock'
import { ParsedActionSummary } from '~~/components/world/ParsedActionSummary'
import { getSqlClient } from '~~/server/db/client.mjs'
import { getMoveCallByTxDigestAndCallIndex } from '~~/server/indexer/listing-repository.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatDate(value: string | null) {
  if (!value) {
    return 'Pending'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value))
}

function Stat({
  label,
  value,
}: {
  label: string
  value: string
}) {
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

export default async function MoveCallDetailPage({
  params,
}: {
  params: Promise<{ txDigest: string; callIndex: string }>
}) {
  const { txDigest, callIndex } = await params
  const parsedCallIndex = Number.parseInt(callIndex, 10)

  if (Number.isNaN(parsedCallIndex)) {
    notFound()
  }

  const moveCall = await getMoveCallByTxDigestAndCallIndex(
    getSqlClient(),
    txDigest,
    parsedCallIndex
  )

  if (!moveCall) {
    notFound()
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
              {moveCall.moduleName ?? 'unknown'}::{moveCall.functionName ?? 'unknown'}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              This page shows the parsed action, raw call payload, and parent transaction summary for a single move call.
            </p>
          </div>
          <a
            href={`/indexer/transaction-blocks/${encodeURIComponent(moveCall.txDigest)}`}
            className="font-display inline-flex items-center rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
          >
            Open Transaction
          </a>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Tx Digest" value={moveCall.txDigest} />
          <Stat label="Call Index" value={String(moveCall.callIndex ?? '--')} />
          <Stat label="Sender" value={moveCall.senderAddress ?? 'Unknown'} />
          <Stat label="Time" value={formatDate(moveCall.transactionTime)} />
        </div>

        <div className="mt-5 rounded-[1.4rem] border border-emerald-300/60 bg-emerald-50/85 p-5 text-sm leading-7 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="font-display text-[11px] uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
            Parsed Action
          </div>
          <div className="mt-2">
            <ParsedActionSummary
              summary={moveCall.actionSummary}
              entities={moveCall.actionEntities}
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
          value={moveCall.rawCall}
          className="max-h-[36rem] rounded-none border-0 p-5"
        />
      </section>
    </section>
  )
}
