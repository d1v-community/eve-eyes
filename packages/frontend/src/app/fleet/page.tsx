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
            This page uses the ship list plus one detailed ship payload to keep
            the view fast while still showing meaningful fit and travel stats.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
          {featuredShipResult?.data ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Featured hull
                </div>
                <h2 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
                  {featuredShipResult.data.name}
                </h2>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {featuredShipResult.data.className}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Speed {featuredShipResult.data.physics.maximumVelocity}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Fuel {featuredShipResult.data.fuelCapacity}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  CPU {featuredShipResult.data.cpuOutput}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  Grid {featuredShipResult.data.powergridOutput}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
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
