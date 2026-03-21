import { KeyRound, ShieldCheck } from 'lucide-react'
import AccessLoginPanel from '../components/world/AccessLoginPanel'
import JumpsAccessPanel from '../components/world/JumpsAccessPanel'
import { getServerSessionUser } from '../server/auth/server-session.mjs'

export default async function AccessPage() {
  const user = await getServerSessionUser()

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6 px-3">
      <section className="rounded-[2.2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.94))] p-6 shadow-[0_30px_90px_rgba(15,23,42,0.1)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.24),_transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(15,23,42,0.86))] md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/80 px-3 py-1.5 text-xs uppercase tracking-[0.28em] text-sky-700 shadow-[0_10px_24px_rgba(14,165,233,0.08)] dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            API Access
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            <KeyRound className="h-3.5 w-3.5" />
            Private
          </div>
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white md:text-5xl">
          Keys, auth, and indexed query docs.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          Wallet login unlocks JWT access. API keys handle automation. Transaction Blocks
          and Move Call filters are documented below with copy-ready examples.
        </p>
      </section>

      {user ? <JumpsAccessPanel /> : <AccessLoginPanel />}
    </div>
  )
}
