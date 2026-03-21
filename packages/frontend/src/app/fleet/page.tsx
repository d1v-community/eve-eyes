import { ShipWheel } from 'lucide-react'
import OperationsShell from '../components/world/OperationsShell'
import { getShip, listShips } from '../world/api'

export default async function FleetPage() {
  const shipsResult = await listShips(6)
  const featuredShipId = shipsResult.data?.data[0]?.id
  const featuredShipResult =
    featuredShipId != null ? await getShip(featuredShipId) : null

  return (
    <OperationsShell>
      <div className="flex flex-col gap-6">
        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
              <ShipWheel className="h-3.5 w-3.5" />
              Fleet
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Ship stats, surfaced as a planning tool instead of raw rows.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              This page uses the ship list plus one detailed ship payload to keep the view fast
              while still showing meaningful fit and travel stats.
            </p>
          </div>

          <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
            {featuredShipResult?.data ? (
              <div className="space-y-5">
                <div>
                  <div className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50/85 px-3 py-1 text-xs uppercase tracking-[0.28em] text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                    Featured hull
                  </div>
                  <h2 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">
                    {featuredShipResult.data.name}
                  </h2>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {featuredShipResult.data.className}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,6,23,0.7))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      Speed
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">
                      {featuredShipResult.data.physics.maximumVelocity}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,6,23,0.7))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      Fuel
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">
                      {featuredShipResult.data.fuelCapacity}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,6,23,0.7))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      CPU
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">
                      {featuredShipResult.data.cpuOutput}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,6,23,0.7))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      Grid
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">
                      {featuredShipResult.data.powergridOutput}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-300/90 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  Pulled from the detailed ship endpoint to keep one hull in focus while the rest
                  of the fleet stays list-first.
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300/90 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {featuredShipResult?.error ?? shipsResult.error}
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shipsResult.data?.data.map((ship) => (
            <article
              key={ship.id}
              className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75"
            >
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                {ship.name}
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {ship.className}
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
                {ship.description}
              </p>
            </article>
          ))}
        </section>
      </div>
    </OperationsShell>
  )
}
