import { ArrowRightLeft } from 'lucide-react'
import { getMyJump, listMyJumps } from '../world/api'

export default async function JumpsPage() {
  const jumpsResult = await listMyJumps(8)
  const firstJumpId = jumpsResult.data?.data[0]?.id
  const firstJumpResult =
    firstJumpId != null ? await getMyJump(firstJumpId) : null

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6 px-3">
      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Jumps
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Private jump history, with graceful token-aware fallbacks.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            This page stays honest: if the server token is missing, the user
            sees a clear unlock state instead of a broken panel.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          {firstJumpResult?.data ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Latest route
                </div>
                <h2 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
                  {firstJumpResult.data.origin.name} to{' '}
                  {firstJumpResult.data.destination.name}
                </h2>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {firstJumpResult.data.time}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                Ship {firstJumpResult.data.ship?.name ?? 'Unknown'} ·{' '}
                {firstJumpResult.data.ship?.className ?? 'Unknown class'}
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

      {jumpsResult.data?.data.length ? (
        <section className="grid gap-4">
          {jumpsResult.data.data.map((jump) => (
            <article
              key={jump.id}
              className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                  {jump.origin.name} to {jump.destination.name}
                </h2>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  {jump.time}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Ship {jump.ship?.name ?? 'Unknown'} ·{' '}
                {jump.ship?.className ?? 'Unknown class'}
              </p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  )
}
