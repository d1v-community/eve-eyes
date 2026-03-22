import { Activity } from 'lucide-react'
import NetworkSupportChecker from './components/NetworkSupportChecker'
import ModuleCallCountsLive from './components/world/ModuleCallCountsLive'
import OverviewIndexerTables from './components/world/OverviewIndexerTables'
import OverviewSystemFootprint from './components/world/OverviewSystemFootprint'
import { getModuleCallCounts } from './server/indexer/repository.mjs'
import { getSqlClient } from './server/db/client.mjs'
import {
  getWorldConfig,
  getWorldHealth,
  listConstellations,
  listMyJumps,
  listShips,
  listSolarSystems,
  listTribes,
  listTypes,
} from './world/api'

export const dynamic = 'force-dynamic'
export default async function Home() {
  const [
    healthResult,
    configResult,
    solarSystemsResult,
    constellationsResult,
    shipsResult,
    typesResult,
    tribesResult,
    jumpsResult,
    moduleCallCounts,
  ] =
    await Promise.all([
      getWorldHealth(),
      getWorldConfig(),
      listSolarSystems(36),
      listConstellations(12),
      listShips(1),
      listTypes(1),
      listTribes(1),
      listMyJumps(24),
      getModuleCallCounts(getSqlClient()),
    ])

  const totalSystems = solarSystemsResult.data?.metadata.total ?? 0
  const totalConstellations = constellationsResult.data?.metadata.total ?? 0
  const signingKey = configResult.data?.[0]?.podPublicSigningKey
  const jumpsLocked = jumpsResult.error === 'Missing WORLD_API_BEARER_TOKEN'

  return (
    <>
      {/* <EnvConfigWarning /> */}
      <NetworkSupportChecker />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
        <section className="w-full overflow-hidden rounded-[2.2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_30%),radial-gradient(circle_at_85%_15%,_rgba(56,189,248,0.14),_transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.92))] p-4 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_28%),radial-gradient(circle_at_85%_15%,_rgba(29,78,216,0.18),_transparent_20%),linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.88))] md:p-6">
          <div className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="rounded-[1.9rem] border border-slate-200/70 bg-white/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-slate-800 dark:bg-slate-950/40 md:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200">
                  Look on Chain
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {healthResult.error == null ? 'Network live' : 'Needs attention'}
                </span>
              </div>

              <div className="mt-5 max-w-3xl">
                <h1 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white md:text-6xl">
                  Route planning,
                  <br />
                  verification, and
                  <br />
                  live intel in one surface.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                  Built like an operator console instead of a brochure:
                  fast-entry modules, system reach, and trust signals surfaced
                  before you click through.
                </p>
              </div>

              <OverviewSystemFootprint
                totalSystems={totalSystems}
                totalConstellations={totalConstellations}
                signingKey={signingKey ?? null}
              />
            </div>

            <div className="grid gap-4">
              <article className="group relative overflow-hidden rounded-[1.9rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(240,249,255,0.88))] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_22px_60px_rgba(14,165,233,0.14)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.86),rgba(8,47,73,0.45))] dark:hover:border-sky-700">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent opacity-70" />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                      Live telemetry
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      Runtime panel
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 p-3 text-sky-700 transition group-hover:rotate-6 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300">
                    <Activity className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Realtime surfaces
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <a
                      href="/fleet"
                      className="rounded-[1.15rem] border border-slate-200/80 bg-white/82 px-4 py-4 transition duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_14px_30px_rgba(56,189,248,0.1)] dark:border-slate-800 dark:bg-slate-950/45 dark:hover:border-sky-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-slate-950 dark:text-white">
                            Fleet
                          </div>
                          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                            /fleet
                          </div>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
                          live
                        </span>
                      </div>
                      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        {shipsResult.data?.metadata.total ?? 0} hulls
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                        {shipsResult.data?.data[0]?.name != null
                          ? `Featured hull ${shipsResult.data.data[0].name} is available for detail inspection.`
                          : shipsResult.error ?? 'Ship catalog unavailable.'}
                      </div>
                    </a>

                    <a
                      href="/codex"
                      className="rounded-[1.15rem] border border-slate-200/80 bg-white/82 px-4 py-4 transition duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_14px_30px_rgba(56,189,248,0.1)] dark:border-slate-800 dark:bg-slate-950/45 dark:hover:border-sky-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-slate-950 dark:text-white">
                            Codex
                          </div>
                          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                            /codex
                          </div>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
                          live
                        </span>
                      </div>
                      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        {typesResult.data?.metadata.total ?? 0} types
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                        {typesResult.data?.data[0] != null
                          ? `${typesResult.data.data[0].name} metadata is queryable.`
                          : typesResult.error ?? 'Type catalog unavailable.'}
                      </div>
                    </a>

                    <a
                      href="/tribes"
                      className="rounded-[1.15rem] border border-slate-200/80 bg-white/82 px-4 py-4 transition duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_14px_30px_rgba(56,189,248,0.1)] dark:border-slate-800 dark:bg-slate-950/45 dark:hover:border-sky-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-slate-950 dark:text-white">
                            Tribes
                          </div>
                          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                            /tribes
                          </div>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
                          live
                        </span>
                      </div>
                      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        {tribesResult.data?.metadata.total ?? 0} tribes
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                        {tribesResult.data?.data[0] != null
                          ? `Sample tag ${tribesResult.data.data[0].nameShort} with tax rate ${Math.round(
                            tribesResult.data.data[0].taxRate * 100
                          )}%.`
                          : tribesResult.error ?? 'Tribe intel unavailable.'}
                      </div>
                    </a>

                    <a
                      href="/jumps"
                      className="rounded-[1.15rem] border border-slate-200/80 bg-white/82 px-4 py-4 transition duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_14px_30px_rgba(56,189,248,0.1)] dark:border-slate-800 dark:bg-slate-950/45 dark:hover:border-sky-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-slate-950 dark:text-white">
                            Jumps
                          </div>
                          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                            /jumps
                          </div>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] ${jumpsLocked
                            ? 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300'
                            }`}
                        >
                          {jumpsLocked ? 'locked' : 'live'}
                        </span>
                      </div>
                      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        {jumpsLocked
                          ? 'Token required'
                          : `${jumpsResult.data?.metadata.total ?? 0} jumps`}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                        {jumpsLocked
                          ? 'Set WORLD_API_BEARER_TOKEN to expose private travel history.'
                          : jumpsResult.error ?? 'Travel history available.'}
                      </div>
                    </a>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
        <ModuleCallCountsLive initialModules={moduleCallCounts} />
        <OverviewIndexerTables />
      </div>
    </>
  )
}
