import { notFound } from 'next/navigation'
import { JsonCodeBlock } from '~~/components/world/JsonCodeBlock'
import { ParsedActionSummary } from '~~/components/world/ParsedActionSummary'
import { getSqlClient } from '~~/server/db/client.mjs'
import {
  getTransactionBlockByDigest,
  listMoveCallsByTxDigest,
} from '~~/server/indexer/listing-repository.mjs'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type MoveCallDetailItem = Awaited<ReturnType<typeof listMoveCallsByTxDigest>>[number]

function truncateValue(value: string | null, start = 10, end = 8) {
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

function JsonCard({
  title,
  value,
}: {
  title: string
  value: unknown
}) {
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

export default async function TransactionBlockDetailPage({
  params,
}: {
  params: Promise<{ digest: string }>
}) {
  const { digest } = await params
  const sql = getSqlClient()
  const transaction = await getTransactionBlockByDigest(sql, digest)

  if (!transaction) {
    notFound()
  }

  const moveCalls = await listMoveCallsByTxDigest(sql, digest)

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
      <article className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.92))] p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.88))]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-display inline-flex rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
              Transaction Block
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              {truncateValue(transaction.digest, 16, 14)}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              Inspect the transaction summary, raw on-chain payloads, and the parsed move call list for this transaction.
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
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
            Parsed Move Calls
          </h2>
        </div>

        {moveCalls.length > 0 ? (
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
                {moveCalls.map((moveCall: MoveCallDetailItem) => (
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
