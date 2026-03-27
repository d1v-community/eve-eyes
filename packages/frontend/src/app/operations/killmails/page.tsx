import { Activity, ArrowUpRight, Crosshair, Filter, ScrollText } from 'lucide-react'
import Link from 'next/link'
import { TESTNET_EXPLORER_URL } from '~~/config/network'
import { transactionUrl } from '~~/helpers/network'
import OperationsShell from '../../components/world/OperationsShell'
import { getSqlClient } from '../../server/db/client.mjs'
import {
  getKillmailSummary,
  listKillmailRecordsWithUsernames,
} from '../../server/indexer/repository.mjs'

const STATUS_OPTIONS = [
  { value: null, label: 'All' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'pending', label: 'Pending' },
] as const

type StatusValue = Exclude<(typeof STATUS_OPTIONS)[number]['value'], null>

type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>

type KillmailRecord = {
  tenant: string
  killmailItemId: string
  txDigest: string
  eventSeq: string
  txCheckpoint: string | null
  txTimestamp: string
  killTimestamp: string
  killTimestampUnix: string
  lossType: string
  solarSystemId: string
  killerCharacterItemId: string
  victimCharacterItemId: string
  reportedByCharacterItemId: string
  killerWalletAddress: string | null
  victimWalletAddress: string | null
  reportedByWalletAddress: string | null
  killerUsername: string | null
  victimUsername: string | null
  reportedByUsername: string | null
  resolutionStatus: 'resolved' | 'pending'
  resolutionError: string | null
  resolvedAt: string | null
  rawEvent: unknown
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const statusTone = {
  resolved:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300',
  pending:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300',
} as const

function normalizeStatus(value: string | string[] | undefined): StatusValue | null {
  const singleValue = Array.isArray(value) ? value[0] : value

  if (singleValue === 'resolved' || singleValue === 'pending') {
    return singleValue
  }

  return null
}

function normalizeKillmailItemId(value: string | string[] | undefined) {
  const singleValue = Array.isArray(value) ? value[0] : value

  return typeof singleValue === 'string' && singleValue.trim().length > 0
    ? singleValue.trim()
    : null
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Pending'
  }

  return dateTimeFormatter.format(new Date(value))
}

function truncateValue(value: string, start = 10, end = 8) {
  if (value.length <= start + end + 3) {
    return value
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`
}

function formatPartyLabel(
  username: string | null,
  walletAddress: string | null,
  characterItemId: string
) {
  if (username) {
    return username
  }

  return walletAddress ? truncateValue(walletAddress, 10, 6) : `Character ${characterItemId}`
}

function buildStatusHref(status: string | null, selectedKillmailId: string | null) {
  const params = new URLSearchParams()

  if (status) {
    params.set('status', status)
  }

  if (selectedKillmailId) {
    params.set('killmailItemId', selectedKillmailId)
  }

  const query = params.toString()

  return query.length > 0 ? `/operations/killmails?${query}` : '/operations/killmails'
}

function buildKillmailHref(status: string | null, killmailItemId: string) {
  const params = new URLSearchParams()

  if (status) {
    params.set('status', status)
  }

  params.set('killmailItemId', killmailItemId)

  return `/operations/killmails?${params.toString()}`
}

export const dynamic = 'force-dynamic'

export default async function KillmailsPage({
  searchParams,
}: {
  searchParams?: SearchParamsInput
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {})
  const status = normalizeStatus(resolvedSearchParams.status)
  const selectedKillmailItemId = normalizeKillmailItemId(
    resolvedSearchParams.killmailItemId
  )
  const sql = getSqlClient()

  const [summary, killmails]: [
    Awaited<ReturnType<typeof getKillmailSummary>>,
    KillmailRecord[],
  ] = await Promise.all([
    getKillmailSummary(sql),
    listKillmailRecordsWithUsernames(sql, { status, limit: 40 }),
  ])

  const selectedKillmail =
    killmails.find((record) => record.killmailItemId === selectedKillmailItemId) ??
    killmails[0] ??
    null

  return (
    <OperationsShell>
      <div className="flex flex-col gap-6">
        <section className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
          <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-200/80 bg-rose-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
              <Crosshair className="h-3.5 w-3.5" />
              Killmails
            </div>
            <h1 className="mt-4 max-w-[13ch] text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
              Observed killmail events, indexed from chain activity.
            </h1>
            <p className="mt-4 max-w-[34rem] text-sm leading-7 text-slate-600 dark:text-slate-300">
              Recent killmail events derived from indexed transactions, with
              wallet resolution and raw event detail.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-[1.6rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/75">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Total records
              </div>
              <div className="font-display mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                {summary.totalRecords.toLocaleString('en-US')}
              </div>
            </article>

            <article className="rounded-[1.6rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/75">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Resolved
              </div>
              <div className="font-display mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                {summary.resolvedTotal.toLocaleString('en-US')}
              </div>
            </article>

            <article className="rounded-[1.6rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/75">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Pending
              </div>
              <div className="font-display mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                {summary.pendingTotal.toLocaleString('en-US')}
              </div>
            </article>

            <article className="rounded-[1.6rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/75">
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Latest event
              </div>
              <div className="font-data mt-3 text-[1.1rem] text-slate-950 dark:text-white">
                {formatDateTime(summary.latestKillAt)}
              </div>
            </article>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
                <Filter className="h-3.5 w-3.5" />
                Filter
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Killmail event stream
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => {
                const isActive = option.value === status

                return (
                  <Link
                    key={option.label}
                    href={buildStatusHref(option.value, selectedKillmail?.killmailItemId ?? null)}
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'border-sky-300 bg-sky-50 text-sky-800 shadow-[0_12px_30px_rgba(77,162,255,0.16)] dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100'
                        : 'border-slate-200/70 bg-white/70 text-slate-700 hover:border-sky-300 hover:bg-sky-50/60 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200 dark:hover:border-sky-800 dark:hover:bg-sky-950/20'
                    }`}
                  >
                    {option.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
            <div className="mb-4 flex items-center gap-3">
              <Activity className="h-5 w-5 text-sky-600 dark:text-sky-300" />
              <div>
                <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Recent records
                </div>
                <div className="font-body text-base font-medium text-slate-900 dark:text-slate-100">
                  Latest observed killmails
                </div>
              </div>
            </div>

            {killmails.length > 0 ? (
              <div className="grid gap-3">
                {killmails.map((record) => {
                  const isSelected =
                    selectedKillmail?.killmailItemId === record.killmailItemId

                  return (
                    <Link
                      key={record.killmailItemId}
                      href={buildKillmailHref(status, record.killmailItemId)}
                      className={`rounded-[1.4rem] border p-4 transition ${
                        isSelected
                          ? 'border-sky-300 bg-sky-50/75 shadow-[0_18px_36px_rgba(56,189,248,0.1)] dark:border-sky-700 dark:bg-sky-950/25'
                          : 'border-slate-200/70 bg-slate-50/80 hover:border-sky-300 hover:bg-sky-50/55 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-sky-800 dark:hover:bg-sky-950/15'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                          {record.lossType}
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.22em] ${statusTone[record.resolutionStatus]}`}
                        >
                          {record.resolutionStatus}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                            Victim
                          </span>
                          <span className="font-data text-sm text-slate-700 dark:text-slate-200">
                            {formatPartyLabel(
                              record.victimUsername,
                              record.victimWalletAddress,
                              record.victimCharacterItemId
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-display text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                            Killer
                          </span>
                          <span className="font-data text-sm text-slate-700 dark:text-slate-200">
                            {formatPartyLabel(
                              record.killerUsername,
                              record.killerWalletAddress,
                              record.killerCharacterItemId
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-display text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                            Time
                          </span>
                          <span className="font-data text-sm text-slate-600 dark:text-slate-300">
                            {formatDateTime(record.killTimestamp)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-6 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                No killmail records are available for the current filter.
              </div>
            )}
          </div>

          <div className="xl:sticky xl:top-24">
            <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
              <div className="mb-4 flex items-center gap-3">
                <ScrollText className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                <div>
                  <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    Detail
                  </div>
                  <div className="font-body text-base font-medium text-slate-900 dark:text-slate-100">
                    Selected killmail
                  </div>
                </div>
              </div>

              {selectedKillmail ? (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        Killmail item
                      </div>
                      <div className="font-data mt-2 text-[1.15rem] text-slate-950 dark:text-white">
                        {selectedKillmail.killmailItemId}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.22em] ${statusTone[selectedKillmail.resolutionStatus]}`}
                        >
                          {selectedKillmail.resolutionStatus}
                        </span>
                        <span className="font-display rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                          {selectedKillmail.lossType}
                        </span>
                      </div>
                    </div>

                    <a
                      href={transactionUrl(TESTNET_EXPLORER_URL, selectedKillmail.txDigest)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
                    >
                      Open tx
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        Victim
                      </div>
                      <div className="mt-2">
                        {selectedKillmail.victimWalletAddress ? (
                          <Link
                            href={`/history/${encodeURIComponent(selectedKillmail.victimWalletAddress)}`}
                            className="font-data text-sm text-slate-950 underline-offset-4 hover:text-sky-700 hover:underline dark:text-white dark:hover:text-sky-300"
                          >
                            {selectedKillmail.victimUsername ??
                              truncateValue(selectedKillmail.victimWalletAddress, 10, 6)}
                          </Link>
                        ) : (
                          <div className="font-data text-sm text-slate-950 dark:text-white">
                            {selectedKillmail.victimUsername ??
                              `Character ${selectedKillmail.victimCharacterItemId}`}
                          </div>
                        )}
                      </div>
                      <div className="font-data mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {selectedKillmail.victimWalletAddress
                          ? truncateValue(selectedKillmail.victimWalletAddress, 10, 6)
                          : `Character ${selectedKillmail.victimCharacterItemId}`}
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        Killer
                      </div>
                      <div className="mt-2">
                        {selectedKillmail.killerWalletAddress ? (
                          <Link
                            href={`/history/${encodeURIComponent(selectedKillmail.killerWalletAddress)}`}
                            className="font-data text-sm text-slate-950 underline-offset-4 hover:text-sky-700 hover:underline dark:text-white dark:hover:text-sky-300"
                          >
                            {selectedKillmail.killerUsername ??
                              truncateValue(selectedKillmail.killerWalletAddress, 10, 6)}
                          </Link>
                        ) : (
                          <div className="font-data text-sm text-slate-950 dark:text-white">
                            {selectedKillmail.killerUsername ??
                              `Character ${selectedKillmail.killerCharacterItemId}`}
                          </div>
                        )}
                      </div>
                      <div className="font-data mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {selectedKillmail.killerWalletAddress
                          ? truncateValue(selectedKillmail.killerWalletAddress, 10, 6)
                          : `Character ${selectedKillmail.killerCharacterItemId}`}
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        Solar system
                      </div>
                      <div className="font-data mt-2 text-sm text-slate-950 dark:text-white">
                        {selectedKillmail.solarSystemId}
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        Reported by
                      </div>
                      <div className="mt-2">
                        {selectedKillmail.reportedByWalletAddress ? (
                          <Link
                            href={`/history/${encodeURIComponent(selectedKillmail.reportedByWalletAddress)}`}
                            className="font-data text-sm text-slate-950 underline-offset-4 hover:text-sky-700 hover:underline dark:text-white dark:hover:text-sky-300"
                          >
                            {selectedKillmail.reportedByUsername ??
                              truncateValue(selectedKillmail.reportedByWalletAddress, 10, 6)}
                          </Link>
                        ) : (
                          <div className="font-data text-sm text-slate-950 dark:text-white">
                            {selectedKillmail.reportedByUsername ??
                              `Character ${selectedKillmail.reportedByCharacterItemId}`}
                          </div>
                        )}
                      </div>
                      <div className="font-data mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {selectedKillmail.reportedByWalletAddress
                          ? truncateValue(selectedKillmail.reportedByWalletAddress, 10, 6)
                          : `Character ${selectedKillmail.reportedByCharacterItemId}`}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.35rem] border border-slate-200/70 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        Kill timestamp
                      </div>
                      <div className="font-data mt-2 text-sm text-slate-700 dark:text-slate-200">
                        {formatDateTime(selectedKillmail.killTimestamp)}
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-slate-200/70 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        Tx digest
                      </div>
                      <div className="mt-2">
                        <a
                          href={transactionUrl(
                            TESTNET_EXPLORER_URL,
                            selectedKillmail.txDigest
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="font-data break-all text-sm text-slate-700 underline-offset-4 transition hover:text-sky-700 hover:underline dark:text-slate-200 dark:hover:text-sky-300"
                          title={selectedKillmail.txDigest}
                        >
                          {truncateValue(selectedKillmail.txDigest, 12, 8)}
                        </a>
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-slate-200/70 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        Event seq
                      </div>
                      <div className="font-data mt-2 text-sm text-slate-700 dark:text-slate-200">
                        {selectedKillmail.eventSeq}
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-slate-200/70 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        Checkpoint
                      </div>
                      <div className="font-data mt-2 text-sm text-slate-700 dark:text-slate-200">
                        {selectedKillmail.txCheckpoint ?? 'Unavailable'}
                      </div>
                    </div>
                  </div>

                  {selectedKillmail.resolutionError ? (
                    <div className="rounded-[1.35rem] border border-amber-200/80 bg-amber-50/80 px-4 py-4 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                      {selectedKillmail.resolutionError}
                    </div>
                  ) : null}

                  <details className="rounded-[1.35rem] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/40">
                    <summary className="font-display cursor-pointer text-[11px] uppercase tracking-[0.22em] text-slate-600 dark:text-slate-300">
                      Raw event JSON
                    </summary>
                    <pre className="font-data mt-4 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-700 dark:text-slate-200">
                      {JSON.stringify(selectedKillmail.rawEvent, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-slate-300 px-4 py-6 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  Select a killmail record to inspect its derived event detail.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </OperationsShell>
  )
}
