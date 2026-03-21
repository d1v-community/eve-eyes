import { ShieldCheck } from 'lucide-react'
import OperationsShell from './OperationsShell'

const statCards = Array.from({ length: 2 }, (_, index) => index)
const payloadLines = Array.from({ length: 8 }, (_, index) => index)

function SkeletonLine({
  width,
  className = '',
}: {
  width: string
  className?: string
}) {
  return (
    <div
      className={`sds-skeleton rounded-full ${className}`}
      style={{ width }}
    />
  )
}

export default function VerifyLoadingSkeleton() {
  return (
    <OperationsShell>
      <div className="flex flex-col gap-6">
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="sds-verify-loading-panel rounded-[2rem] border p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mb-6 space-y-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                POD verify
              </div>

              <div className="space-y-3">
                <SkeletonLine width="78%" className="h-5" />
                <SkeletonLine width="88%" className="h-12 rounded-[1.2rem]" />
                <SkeletonLine width="72%" className="h-4" />
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/65 p-4 dark:border-slate-800 dark:bg-slate-950/35">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="sds-skeleton h-12 flex-1 rounded-[1.2rem]" />
                <div className="sds-skeleton h-12 w-full rounded-[1.2rem] sm:w-32" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="sds-skeleton h-9 w-28 rounded-full" />
                <div className="sds-skeleton h-9 w-36 rounded-full" />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-slate-300/90 bg-white/35 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/20">
              <div className="space-y-2">
                <SkeletonLine width="100%" className="h-3.5" />
                <SkeletonLine width="86%" className="h-3.5" />
              </div>
            </div>
          </div>

          <section className="sds-verify-loading-panel rounded-[2rem] border p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <SkeletonLine width="7rem" className="h-3.5" />
                <SkeletonLine width="16rem" className="h-8 rounded-[1rem]" />
              </div>
              <div className="flex gap-2">
                <div className="sds-skeleton h-10 w-24 rounded-full" />
                <div className="sds-skeleton h-10 w-24 rounded-full" />
              </div>
            </div>

            <div className="grid gap-4">
              <article className="sds-verify-card-skeleton rounded-[1.75rem] border p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-3">
                    <SkeletonLine width="6rem" className="h-3.5" />
                    <SkeletonLine width="14rem" className="h-8 rounded-[1rem]" />
                    <SkeletonLine width="18rem" className="h-4" />
                  </div>
                  <div className="sds-skeleton h-8 w-24 rounded-full" />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {statCards.map((card) => (
                    <div
                      key={card}
                      className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <SkeletonLine width="5.5rem" className="h-3" />
                      <SkeletonLine width="100%" className="mt-3 h-4" />
                      <SkeletonLine width="72%" className="mt-2 h-4" />
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {statCards.map((card) => (
                    <div
                      key={`facts-${card}`}
                      className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <SkeletonLine width="4.5rem" className="h-3" />
                      <SkeletonLine width="88%" className="mt-3 h-4" />
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
                <SkeletonLine width="7.5rem" className="mb-4 h-3.5" />
                <div className="grid gap-3 md:grid-cols-2">
                  {statCards.map((card) => (
                    <div
                      key={`system-${card}`}
                      className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50"
                    >
                      <SkeletonLine width="4.5rem" className="h-3" />
                      <SkeletonLine width="90%" className="mt-3 h-4" />
                      <SkeletonLine width="65%" className="mt-2 h-4" />
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
                <SkeletonLine width="10rem" className="mb-4 h-3.5" />
                <div className="rounded-2xl border border-slate-200/70 bg-slate-950 p-4 dark:border-slate-800">
                  <div className="space-y-3">
                    {payloadLines.map((line) => (
                      <div
                        key={line}
                        className="sds-skeleton h-3.5 rounded-full opacity-80"
                        style={{
                          width:
                            line % 4 === 0
                              ? '92%'
                              : line % 4 === 1
                                ? '84%'
                                : line % 4 === 2
                                  ? '96%'
                                  : '68%',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </article>
            </div>
          </section>
        </section>
      </div>
    </OperationsShell>
  )
}
