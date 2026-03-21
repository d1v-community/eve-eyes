import { Activity, Orbit, ShieldCheck } from 'lucide-react'
import NetworkSupportChecker from './components/NetworkSupportChecker'
import OverviewIndexerTables from './components/world/OverviewIndexerTables'
import OverviewModuleGrid from './components/world/OverviewModuleGrid'
import OverviewMapLab from './components/world/OverviewMapLab'
import { getModuleCallCounts } from './server/indexer/repository.mjs'
import { getSqlClient } from './server/db/client.mjs'
import {
  getSolarSystem,
  getWorldConfig,
  getWorldHealth,
  listConstellations,
  listSolarSystems,
} from './world/api'

const numberFormatter = new Intl.NumberFormat('en-US')

export default async function Home() {
  const [
    healthResult,
    configResult,
    solarSystemsResult,
    constellationsResult,
    moduleCallCounts,
  ] =
    await Promise.all([
      getWorldHealth(),
      getWorldConfig(),
      listSolarSystems(36),
      listConstellations(12),
      getModuleCallCounts(getSqlClient()),
    ])

  const sampleSystems = solarSystemsResult.data?.data ?? []
  const sampleConstellations = constellationsResult.data?.data ?? []
  const totalSystems = solarSystemsResult.data?.metadata.total ?? 0
  const totalConstellations = constellationsResult.data?.metadata.total ?? 0
  const signingKey = configResult.data?.[0]?.podPublicSigningKey
  const detailResults = await Promise.all(
    sampleSystems.slice(0, 12).map((system) => getSolarSystem(system.id))
  )
  const gateLinks = detailResults.flatMap((result, index) => {
    const sourceSystem = sampleSystems[index]

    if (result.data == null || sourceSystem == null) return []

    return result.data.gateLinks.map((gate) => ({
      fromId: sourceSystem.id,
      toId: gate.destination.id,
      toConstellationId: gate.destination.constellationId,
    }))
  })

  const systemsForMap = new Map(sampleSystems.map((system) => [system.id, system]))

  for (const result of detailResults) {
    if (result.data == null) continue

    systemsForMap.set(result.data.id, result.data)

    for (const gate of result.data.gateLinks) {
      systemsForMap.set(gate.destination.id, gate.destination)
    }
  }

  const constellationsForMap = new Map(
    sampleConstellations.map((constellation) => [constellation.id, constellation])
  )

  for (const system of systemsForMap.values()) {
    if (constellationsForMap.has(system.constellationId)) continue

    constellationsForMap.set(system.constellationId, {
      id: system.constellationId,
      name: `Constellation ${system.constellationId}`,
      regionId: system.regionId,
      location: system.location,
    })
  }

  return (
    <>
      {/* <EnvConfigWarning /> */}
      <NetworkSupportChecker />
      <div className="flex w-full max-w-6xl flex-col gap-6 px-3">
        <section className="overflow-hidden rounded-[2.2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_30%),radial-gradient(circle_at_85%_15%,_rgba(56,189,248,0.14),_transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.92))] p-4 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_28%),radial-gradient(circle_at_85%_15%,_rgba(29,78,216,0.18),_transparent_20%),linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.88))] md:p-6">
          <div className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="rounded-[1.9rem] border border-slate-200/70 bg-white/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-slate-800 dark:bg-slate-950/40 md:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200">
                  World API cockpit
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

              <div className="mt-8 rounded-[1.55rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(240,249,255,0.82))] p-4 transition duration-200 hover:border-sky-300 hover:shadow-[0_18px_40px_rgba(56,189,248,0.12)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.72),rgba(15,23,42,0.64))] dark:hover:border-sky-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      System footprint
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      Universe coverage and trust state, compressed into one read.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl border border-sky-200/70 bg-sky-50/70 p-2.5 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300">
                      <Orbit className="h-4 w-4" />
                    </div>
                    <div className="rounded-xl border border-sky-200/70 bg-sky-50/70 p-2.5 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.15rem] border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/45">
                    <div className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      {numberFormatter.format(totalSystems)}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Systems
                    </div>
                  </div>
                  <div className="rounded-[1.15rem] border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/45">
                    <div className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      {numberFormatter.format(totalConstellations)}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Constellations
                    </div>
                  </div>
                  <div className="rounded-[1.15rem] border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/45">
                    <div className="truncate text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      {signingKey?.slice(0, 12) ?? 'Unavailable'}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Verify key
                    </div>
                  </div>
                </div>
              </div>
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

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.15rem] border border-slate-200/80 bg-white/82 px-4 py-4 transition dark:border-slate-800 dark:bg-slate-950/45">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Health
                    </div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      {healthResult.error == null ? 'Healthy' : 'Attention'}
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {healthResult.error ?? 'API reachable and ready.'}
                    </div>
                  </div>

                  <div className="rounded-[1.15rem] border border-slate-200/80 bg-white/82 px-4 py-4 transition dark:border-slate-800 dark:bg-slate-950/45">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Coverage
                    </div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      6 modules
                    </div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Atlas, verify, fleet, codex, tribes, and jumps.
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-[1.15rem] border border-slate-200/80 bg-white/82 px-4 py-4 transition dark:border-slate-800 dark:bg-slate-950/45">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        Operator note
                      </div>
                      <div className="mt-2 max-w-md text-sm leading-6 text-slate-700 dark:text-slate-200">
                        Entry points below are intentionally compact: one signal, one note, one click path.
                      </div>
                    </div>
                    <div className="hidden h-12 w-12 rounded-full border border-sky-200/70 bg-sky-50/75 sm:flex sm:items-center sm:justify-center dark:border-sky-900/70 dark:bg-sky-950/30">
                      <Activity className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <div className="mt-4 rounded-[1.9rem] border border-slate-200/70 bg-white/48 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-slate-800 dark:bg-slate-950/28 md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Modules
                </div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Entry matrix
                </h2>
              </div>
              <div className="hidden rounded-full border border-slate-200/80 bg-white/75 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:bg-slate-950/45 dark:text-slate-300 md:inline-flex">
                Direct jump
              </div>
            </div>
            <OverviewModuleGrid />
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Indexer
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                Module Call Counts
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Counts are derived from successful on-chain move call records stored in
                `suiscan_move_calls`.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {moduleCallCounts.map((module) => (
              <article
                key={module.moduleName}
                className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  {module.moduleName}
                </div>
                <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">
                  {numberFormatter.format(module.callCount)}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  Latest tx:{' '}
                  {module.latestTransactionTime
                    ? new Date(module.latestTransactionTime).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                    : 'No data yet'}
                </p>
              </article>
            ))}
          </div>
        </section>

        <OverviewMapLab
          systems={[...systemsForMap.values()]}
          constellations={[...constellationsForMap.values()]}
          gateLinks={gateLinks}
        />

        <OverviewIndexerTables />
      </div>
    </>
  )
}
