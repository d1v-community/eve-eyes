'use client'

export function DetailSkeleton({
  title,
  subtitle,
  stats = 4,
}: {
  title: string
  subtitle: string
  stats?: number
}) {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
      <article className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.92))] p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,0.88))]">
        <div className="animate-pulse">
          <div className="inline-flex rounded-full border border-sky-200/80 bg-sky-50/85 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
            {title}
          </div>
          <div className="mt-4 h-10 w-80 max-w-full rounded-full bg-slate-200/85 dark:bg-slate-800/85" />
          <div className="mt-3 h-4 w-[32rem] max-w-full rounded-full bg-slate-200/70 dark:bg-slate-800/70" />
          <div className="mt-2 h-4 w-[24rem] max-w-full rounded-full bg-slate-200/55 dark:bg-slate-800/55" />
        </div>

        <div className={`mt-6 grid gap-4 md:grid-cols-2 ${stats > 2 ? 'xl:grid-cols-4' : ''}`}>
          {Array.from({ length: stats }).map((_, index) => (
            <div
              key={`detail-skeleton-stat-${index}`}
              className="rounded-[1.1rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55"
            >
              <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-800/70" />
              <div className="mt-3 h-5 w-full animate-pulse rounded-full bg-slate-200/85 dark:bg-slate-800/85" />
            </div>
          ))}
        </div>
      </article>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/85 dark:border-slate-800 dark:bg-slate-950/55">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
            {subtitle}
          </h2>
        </div>
        <div className="space-y-3 px-5 py-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`detail-skeleton-row-${index}`}
              className="h-14 animate-pulse rounded-[1rem] bg-slate-100/90 dark:bg-slate-900/80"
            />
          ))}
        </div>
      </section>
    </section>
  )
}

export function DetailEmpty({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-950/55">
      <div className="font-display text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
        {title}
      </div>
      <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{message}</p>
    </div>
  )
}

export function DetailError({
  title,
  message,
  retryLabel = 'Retry',
  onRetry,
}: {
  title: string
  message: string
  retryLabel?: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded-[1.5rem] border border-red-300/70 bg-red-50/90 px-6 py-6 dark:border-red-900/70 dark:bg-red-950/30">
      <div className="font-display text-lg font-semibold tracking-[-0.03em] text-red-900 dark:text-red-100">
        {title}
      </div>
      <p className="mt-2 text-sm leading-7 text-red-800 dark:text-red-200">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex rounded-full border border-red-300/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-800 transition hover:-translate-y-0.5 hover:bg-white dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}
