const skeletonCards = Array.from({ length: 4 }, (_, index) => index)

export default function WorldDashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {skeletonCards.map((card) => (
          <div
            key={card}
            className="sds-skeleton h-32 rounded-3xl border border-slate-200/70 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70"
          />
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="sds-skeleton h-72 rounded-3xl border border-slate-200/70 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70" />
        <div className="sds-skeleton h-72 rounded-3xl border border-slate-200/70 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70" />
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        {skeletonCards.slice(0, 3).map((card) => (
          <div
            key={`section-${card}`}
            className="sds-skeleton h-64 rounded-3xl border border-slate-200/70 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70"
          />
        ))}
      </section>
    </div>
  )
}
