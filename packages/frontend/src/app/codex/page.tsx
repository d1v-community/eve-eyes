import { Binary } from 'lucide-react'
import { getType, listTypes } from '../world/api'

export default async function CodexPage() {
  const typesResult = await listTypes(8)
  const featuredTypeId = typesResult.data?.data[0]?.id
  const featuredTypeResult =
    featuredTypeId != null ? await getType(featuredTypeId) : null

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6 px-3">
      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
            <Binary className="h-3.5 w-3.5" />
            Codex
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Type metadata organized around discovery and logistics.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            The list stays compact, while the featured detail highlights category,
            group, mass, volume, and portion size.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          {featuredTypeResult?.data ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Featured type
                </div>
                <h2 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
                  {featuredTypeResult.data.name}
                </h2>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {featuredTypeResult.data.categoryName} /{' '}
                  {featuredTypeResult.data.groupName}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Volume {featuredTypeResult.data.volume}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Mass {featuredTypeResult.data.mass}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Radius {featuredTypeResult.data.radius}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Portion {featuredTypeResult.data.portionSize}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {featuredTypeResult?.error ?? typesResult.error}
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {typesResult.data?.data.map((item) => (
          <article
            key={item.id}
            className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75"
          >
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              {item.name}
            </h2>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              {item.categoryName}
            </p>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              {item.groupName}
            </p>
          </article>
        ))}
      </section>
    </div>
  )
}
