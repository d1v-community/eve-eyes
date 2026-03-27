import { Building2, Crown, Radar, Trophy } from 'lucide-react'
import Link from 'next/link'
import LeaderboardOwnerCell from '../components/world/LeaderboardOwnerCell'
import OperationsShell from '../components/world/OperationsShell'
import { getSqlClient } from '../server/db/client.mjs'
import {
  getBuildingLeaderboardSummary,
  listBuildingLeaderboard,
} from '../server/indexer/repository.mjs'

const MODULE_OPTIONS = [
  { value: null, label: 'All' },
  { value: 'assembly', label: 'Assembly' },
  { value: 'gate', label: 'Gate' },
  { value: 'network_node', label: 'Network Node' },
  { value: 'storage_unit', label: 'Storage Unit' },
  { value: 'turret', label: 'Turret' },
] as const

type ModuleName = Exclude<(typeof MODULE_OPTIONS)[number]['value'], null>

type LeaderboardEntry = {
  rank: number
  tenant: string
  ownerCharacterItemId: string
  userId: string
  walletAddress: string | null
  username: string | null
  buildingCount: number
  lastSeenAt: string | null
}

const validModuleNames = new Set<string>(
  MODULE_OPTIONS.map((item) => item.value).filter((value) => value != null)
)

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>

function normalizeModuleName(
  value: string | string[] | undefined
): ModuleName | null {
  const singleValue = Array.isArray(value) ? value[0] : value

  if (typeof singleValue !== 'string') {
    return null
  }

  const normalized = singleValue.trim().toLowerCase()

  return validModuleNames.has(normalized) ? (normalized as ModuleName) : null
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Pending'
  }

  return dateFormatter.format(new Date(value))
}

function buildModuleHref(moduleName: string | null) {
  return moduleName == null
    ? '/leaderboards'
    : `/leaderboards?moduleName=${moduleName}`
}

export const dynamic = 'force-dynamic'

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams?: SearchParamsInput
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {})
  const moduleName = normalizeModuleName(resolvedSearchParams.moduleName)
  const sql = getSqlClient()
  const [summary, leaderboard]: [
    Awaited<ReturnType<typeof getBuildingLeaderboardSummary>>,
    LeaderboardEntry[],
  ] = await Promise.all([
    getBuildingLeaderboardSummary(sql, { moduleName }),
    listBuildingLeaderboard(sql, { limit: 50, moduleName }),
  ])

  const leader = leaderboard[0] ?? null
  const activeModuleLabel =
    MODULE_OPTIONS.find((option) => option.value === moduleName)?.label ?? 'All'

  return (
    <OperationsShell>
      <div className="flex flex-col gap-6">
        <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
              <Trophy className="h-3.5 w-3.5" />
              Leaderboards
            </div>
            <h1 className="mt-4 max-w-[12ch] text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl sm:leading-[0.96] dark:text-white">
              Observed building holdings, ranked by active footprint.
            </h1>
            <p className="mt-4 max-w-[34rem] text-sm leading-7 text-slate-600 dark:text-slate-300">
              An on-chain board of active building owners. Observed footprint,
              not full off-chain inventory.
            </p>
          </div>

          <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75 xl:p-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              <Crown className="h-3.5 w-3.5" />
              Top owner
            </div>

            {leader ? (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    Owner
                  </div>
                  <div className="mt-2">
                    <LeaderboardOwnerCell
                      tenant={leader.tenant}
                      walletAddress={leader.walletAddress}
                      username={leader.username}
                      userId={leader.userId}
                      variant="hero"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="font-display text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                      Character ID
                    </span>
                    <span className="font-data text-sm text-slate-600 dark:text-slate-300">
                      {leader.ownerCharacterItemId}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      Holdings
                    </div>
                    <div className="font-data mt-3 text-[2rem] text-slate-950 dark:text-white">
                      {leader.buildingCount.toLocaleString('en-US')}
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      Last seen
                    </div>
                    <div className="font-data mt-3 text-lg text-slate-950 dark:text-white">
                      {formatDateTime(leader.lastSeenAt)}
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                  Module filters keep the same ranking model.
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[1.35rem] border border-dashed border-slate-300 px-4 py-4 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                No observed building owners are available yet.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-[1.6rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/75">
            <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Active buildings
            </div>
            <div className="font-display mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              {summary.activeBuildingTotal.toLocaleString('en-US')}
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/75">
            <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Ranked owners
            </div>
            <div className="font-display mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              {summary.rankedOwnerTotal.toLocaleString('en-US')}
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/75">
            <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Last observed
            </div>
            <div className="font-data mt-3 text-[1.35rem] text-slate-950 dark:text-white">
              {formatDateTime(summary.latestSeenAt)}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
                <Radar className="h-3.5 w-3.5" />
                Filter
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                {activeModuleLabel} leaderboard
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {MODULE_OPTIONS.map((option) => {
                const isActive = option.value === moduleName

                return (
                  <Link
                    key={option.label}
                    href={buildModuleHref(option.value)}
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

        <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          <div className="mb-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-sky-600 dark:text-sky-300" />
            <div>
              <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Rankings
              </div>
              <div className="font-body text-base font-medium text-slate-900 dark:text-slate-100">
                Top observed owners
              </div>
            </div>
          </div>

          {leaderboard.length > 0 ? (
            <>
              <div className="relative hidden overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] lg:block dark:border-slate-800 dark:bg-slate-950/55">
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] border-separate border-spacing-0 md:min-w-full">
                    <thead>
                      <tr className="bg-slate-50/95 dark:bg-slate-950/95">
                        <th className="font-display border-b border-slate-200/80 px-4 py-4 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                          Rank
                        </th>
                        <th className="font-display border-b border-slate-200/80 px-4 py-4 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                          Owner
                        </th>
                        <th className="font-display border-b border-slate-200/80 px-4 py-4 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                          Character ID
                        </th>
                        <th className="font-display border-b border-slate-200/80 px-4 py-4 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                          Buildings
                        </th>
                        <th className="font-display border-b border-slate-200/80 px-4 py-4 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                          Last seen
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry: LeaderboardEntry) => (
                        <tr
                          key={`${entry.tenant}:${entry.ownerCharacterItemId}`}
                          className="transition-colors duration-150 hover:bg-sky-50/55 dark:hover:bg-slate-900/80"
                        >
                          <td className="h-[76px] border-b border-slate-200/70 px-4 py-4 align-middle dark:border-slate-800">
                            <span className="font-data text-base text-slate-950 dark:text-white">
                              {entry.rank}
                            </span>
                          </td>
                          <td className="h-[76px] border-b border-slate-200/70 px-4 py-4 align-middle text-sm dark:border-slate-800">
                             <LeaderboardOwnerCell
                               tenant={entry.tenant}
                               walletAddress={entry.walletAddress}
                               username={entry.username}
                               userId={entry.userId}
                             />
                          </td>
                          <td className="h-[76px] border-b border-slate-200/70 px-4 py-4 align-middle dark:border-slate-800">
                            <span className="font-data text-sm text-slate-600 dark:text-slate-300">
                              {entry.ownerCharacterItemId}
                            </span>
                          </td>
                          <td className="h-[76px] border-b border-slate-200/70 px-4 py-4 align-middle dark:border-slate-800">
                            <span className="font-data text-base text-slate-950 dark:text-white">
                              {entry.buildingCount.toLocaleString('en-US')}
                            </span>
                          </td>
                          <td className="h-[76px] border-b border-slate-200/70 px-4 py-4 align-middle dark:border-slate-800">
                            <span className="font-data text-sm text-slate-600 dark:text-slate-300">
                              {formatDateTime(entry.lastSeenAt)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-4 lg:hidden">
                {leaderboard.map((entry: LeaderboardEntry) => (
                  <article
                    key={`${entry.tenant}:${entry.ownerCharacterItemId}`}
                    className="rounded-[1.5rem] border border-slate-200/70 bg-slate-50/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-display text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                          Rank {entry.rank}
                        </div>
                        <div className="mt-2">
                           <LeaderboardOwnerCell
                             tenant={entry.tenant}
                             walletAddress={entry.walletAddress}
                             username={entry.username}
                             userId={entry.userId}
                           />
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="font-display text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                            Character ID
                          </span>
                          <span className="font-data text-sm text-slate-700 dark:text-slate-200">
                            {entry.ownerCharacterItemId}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 dark:border-sky-900/70 dark:bg-sky-950/40">
                        <span className="font-data text-sm text-sky-700 dark:text-sky-200">
                          {entry.buildingCount.toLocaleString('en-US')}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="font-display text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                        Last seen
                      </span>
                      <span className="font-data text-sm text-slate-600 dark:text-slate-300">
                        {formatDateTime(entry.lastSeenAt)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-6 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              No leaderboard rows are available for the current filter.
            </div>
          )}
        </section>
      </div>
    </OperationsShell>
  )
}
