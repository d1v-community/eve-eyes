import { Swords } from 'lucide-react'
import OperationsShell from '../components/world/OperationsShell'
import { getTribe, listTribes } from '../world/api'

export default async function TribesPage() {
  const tribesResult = await listTribes(6)
  const featuredTribeId = tribesResult.data?.data[0]?.id
  const featuredTribeResult =
    featuredTribeId != null ? await getTribe(featuredTribeId) : null

  return (
    <OperationsShell>
      <div className="flex flex-col gap-6">
        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
            <Swords className="h-3.5 w-3.5" />
            Tribes
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
            A compact tribe intel board.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            Lightweight metadata deserves a lightweight page: short tag, tax,
            description, and outbound link.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          {featuredTribeResult?.data ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Featured tribe
                </div>
                <h2 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
                  {featuredTribeResult.data.name}
                </h2>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {featuredTribeResult.data.nameShort}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                Tax rate {Math.round(featuredTribeResult.data.taxRate * 100)}%
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {featuredTribeResult?.error ?? tribesResult.error}
            </p>
          )}
        </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tribesResult.data?.data.map((tribe) => (
            <article
              key={tribe.id}
              className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                  {tribe.name}
                </h2>
                <div className="rounded-full border border-slate-200/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                  {tribe.nameShort}
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                Tax rate {Math.round(tribe.taxRate * 100)}%
              </p>
              {tribe.tribeUrl ? (
                <a
                  href={tribe.tribeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block truncate text-sm text-sky-700 underline-offset-4 hover:underline dark:text-sky-300"
                >
                  {tribe.tribeUrl}
                </a>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </OperationsShell>
  )
}
