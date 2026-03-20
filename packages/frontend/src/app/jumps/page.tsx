import { ArrowRightLeft, CalendarDays, Flame, ShipWheel } from 'lucide-react'
import OperationsShell from '../components/world/OperationsShell'
import { listMyJumps, type Jump } from '../world/api'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function groupByDay(jumps: Jump[]) {
  const groups = new Map<string, Jump[]>()

  for (const jump of jumps) {
    const dayKey = jump.time.slice(0, 10)
    const current = groups.get(dayKey) ?? []
    current.push(jump)
    groups.set(dayKey, current)
  }

  return [...groups.entries()].map(([day, items]) => ({
    day,
    count: items.length,
    items,
  }))
}

function buildSystemHeat(jumps: Jump[]) {
  const counts = new Map<string, { name: string; count: number }>()

  for (const jump of jumps) {
    const systems = [jump.origin.name, jump.destination.name]

    for (const name of systems) {
      const current = counts.get(name) ?? { name, count: 0 }
      current.count += 1
      counts.set(name, current)
    }
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 12)
}

function buildShipUsage(jumps: Jump[]) {
  const usage = new Map<string, number>()

  for (const jump of jumps) {
    const key =
      jump.ship?.name ??
      jump.ship?.className ??
      'Unknown hull'

    usage.set(key, (usage.get(key) ?? 0) + 1)
  }

  return [...usage.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6)
}

function buildHeatCells(jumps: Jump[]) {
  const byDay = groupByDay(jumps)
  const maxCount = Math.max(...byDay.map((entry) => entry.count), 1)

  return byDay.map((entry) => ({
    day: entry.day,
    count: entry.count,
    intensity: Math.max(0.18, entry.count / maxCount),
  }))
}

export default async function JumpsPage() {
  const jumpsResult = await listMyJumps(24)
  const jumps = jumpsResult.data?.data ?? []
  const latestJump = jumps[0] ?? null
  const groupedDays = groupByDay(jumps)
  const hotSystems = buildSystemHeat(jumps)
  const shipUsage = buildShipUsage(jumps)
  const heatCells = buildHeatCells(jumps)

  return (
    <OperationsShell>
      <div className="flex flex-col gap-6">
        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Jumps
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Personal travel history with timeline, heat, and ship usage.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            The page stays honest: if the server token is missing, the user
            gets a clear unlock state. If it exists, the raw jump list becomes a
            readable travel profile.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          {latestJump ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Latest route
                </div>
                <h2 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
                  {latestJump.origin.name} to {latestJump.destination.name}
                </h2>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {dateFormatter.format(new Date(latestJump.time))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                Ship {latestJump.ship?.name ?? 'Unknown'} ·{' '}
                {latestJump.ship?.className ?? 'Unknown class'}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  {jumps.length} jumps
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  {groupedDays.length} active days
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  {shipUsage.length} hulls used
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              {jumpsResult.error === 'Missing WORLD_API_BEARER_TOKEN'
                ? 'Configure WORLD_API_BEARER_TOKEN to unlock personal jump history.'
                : jumpsResult.error ?? 'No jumps available.'}
            </div>
          )}
        </div>
        </section>

        {jumps.length > 0 ? (
          <>
            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
              <div className="mb-4 flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Travel timeline
                  </div>
                  <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                    Grouped by active day
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {groupedDays.map((group) => (
                  <div key={group.day} className="relative pl-6">
                    <div className="absolute left-1 top-2 h-full w-px bg-slate-200 dark:bg-slate-800" />
                    <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-sky-500" />
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {group.day}
                        </div>
                        <div className="rounded-full border border-slate-200/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                          {group.count} jumps
                        </div>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((jump) => (
                          <div
                            key={jump.id}
                            className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/50"
                          >
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {jump.origin.name} to {jump.destination.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {dateFormatter.format(new Date(jump.time))} ·{' '}
                              {jump.ship?.name ?? 'Unknown hull'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <div className="grid gap-6">
              <article className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
                <div className="mb-4 flex items-center gap-3">
                  <Flame className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      System heat
                    </div>
                    <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                      Most visited systems
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {hotSystems.map((system) => (
                    <div
                      key={system.name}
                      className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {system.name}
                      </div>
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Seen in {system.count} route endpoints
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
                <div className="mb-4 flex items-center gap-3">
                  <ShipWheel className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Hull usage
                    </div>
                    <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                      Ships most used for travel
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {shipUsage.map((ship) => (
                    <div
                      key={ship.name}
                      className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {ship.name}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {ship.count} jumps
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-sky-500"
                          style={{
                            width: `${Math.max(
                              12,
                              (ship.count / Math.max(shipUsage[0]?.count ?? 1, 1)) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
              <div className="mb-4 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Activity heatmap
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                {heatCells.map((cell) => (
                  <div
                    key={cell.day}
                    className="rounded-2xl border border-slate-200/70 p-4 dark:border-slate-800"
                    style={{
                      backgroundColor: `rgba(14, 165, 233, ${cell.intensity})`,
                    }}
                  >
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-700 dark:text-slate-100">
                      {cell.day.slice(5)}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                      {cell.count}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </OperationsShell>
  )
}
