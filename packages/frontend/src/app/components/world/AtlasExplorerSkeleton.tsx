const commandMetrics = Array.from({ length: 3 }, (_, index) => index)
const routeStops = Array.from({ length: 5 }, (_, index) => index)

export default function AtlasExplorerSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[2.2rem] border border-stone-300/70 bg-[linear-gradient(135deg,#f6efe2_0%,#efe4d3_38%,#d9e1e7_100%)] shadow-[0_32px_120px_rgba(40,32,20,0.14)] dark:border-slate-800/90 dark:bg-[linear-gradient(135deg,#030712_0%,#07111c_28%,#081a2b_62%,#0b1120_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.16),transparent_24%),radial-gradient(circle_at_70%_12%,rgba(15,118,110,0.10),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.12),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_24%),radial-gradient(circle_at_70%_12%,rgba(45,212,191,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_20%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-position:center] [background-size:28px_28px]" />

      <div className="relative grid gap-5 p-3 lg:p-4 xl:grid-cols-[22rem_minmax(0,1fr)_20rem]">
        <section className="flex flex-col gap-4 rounded-[1.9rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(252,248,241,0.94),rgba(242,235,223,0.88))] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_20px_50px_rgba(96,74,40,0.14)] dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(6,12,22,0.96),rgba(8,16,28,0.94)_48%,rgba(7,15,24,0.98)_100%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_28px_70px_rgba(2,6,23,0.42)]">
          <div className="space-y-3">
            <div className="sds-skeleton h-6 w-32 rounded-full" />
            <div className="sds-skeleton h-10 w-3/4 rounded-2xl" />
            <div className="sds-skeleton h-20 w-full rounded-[1.4rem]" />
          </div>

          <div className="space-y-4">
            <div className="sds-skeleton h-20 rounded-[1.2rem]" />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="sds-skeleton h-12 rounded-2xl" />
              <div className="sds-skeleton h-12 w-24 rounded-2xl" />
            </div>
            <div className="sds-skeleton h-20 rounded-[1.2rem]" />
            <div className="sds-skeleton h-12 rounded-[1.2rem]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {commandMetrics.map((card) => (
              <div key={card} className="sds-skeleton h-24 rounded-[1.5rem]" />
            ))}
          </div>

          <div className="sds-skeleton h-32 rounded-[1.5rem]" />
        </section>

        <section className="min-w-0 rounded-[2rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(255,252,245,0.88),rgba(240,232,221,0.74))] p-3 shadow-[0_18px_50px_rgba(72,56,32,0.10)] dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(4,10,18,0.95),rgba(6,14,26,0.94))]">
          <div className="mb-3 rounded-[1.6rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,245,238,0.66))] px-4 py-4 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(8,16,28,0.92),rgba(10,20,36,0.88))]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="sds-skeleton h-4 w-28 rounded-full" />
                <div className="sds-skeleton h-8 w-64 rounded-2xl" />
              </div>
              <div className="sds-skeleton h-10 w-44 rounded-full" />
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <div className="sds-skeleton h-10 w-32 rounded-full" />
            <div className="sds-skeleton h-10 w-32 rounded-full" />
            <div className="sds-skeleton h-10 w-32 rounded-full" />
          </div>

          <div className="sds-skeleton h-[560px] rounded-[1.65rem]" />

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {commandMetrics.map((card) => (
              <div key={`atlas-metric-${card}`} className="sds-skeleton h-28 rounded-[1.45rem]" />
            ))}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="sds-skeleton h-36 rounded-[1.45rem]" />
            <div className="sds-skeleton h-36 rounded-[1.45rem]" />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-[1.9rem] border border-stone-300/70 bg-[linear-gradient(180deg,rgba(252,249,244,0.86),rgba(243,237,228,0.74))] p-4 shadow-[0_18px_50px_rgba(72,56,32,0.08)] dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(4,10,18,0.95),rgba(7,14,25,0.92))]">
          <div className="sds-skeleton h-52 rounded-[1.55rem]" />

          <div className="rounded-[1.55rem] border border-stone-300/70 bg-white/70 p-4 dark:border-slate-700/80 dark:bg-slate-950/78">
            <div className="space-y-3">
              <div className="sds-skeleton h-4 w-24 rounded-full" />
              <div className="sds-skeleton h-7 w-40 rounded-2xl" />
              <div className="sds-skeleton h-14 w-full rounded-[1.2rem]" />
              <div className="flex gap-2">
                <div className="sds-skeleton h-10 flex-1 rounded-[1rem]" />
                <div className="sds-skeleton h-10 flex-1 rounded-[1rem]" />
              </div>
              <div className="space-y-2">
                {routeStops.map((stop) => (
                  <div key={stop} className="sds-skeleton h-20 rounded-[1.2rem]" />
                ))}
              </div>
            </div>
          </div>

          <div className="sds-skeleton h-80 rounded-[1.6rem]" />
        </section>
      </div>
    </div>
  )
}
