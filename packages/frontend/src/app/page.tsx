import Link from 'next/link'
import { Activity, Boxes, Orbit, ShieldCheck } from 'lucide-react'
import NetworkSupportChecker from './components/NetworkSupportChecker'
import EnvConfigWarning from './components/EnvConfigWarning'
import { getWorldConfig, getWorldHealth, listConstellations, listSolarSystems } from './world/api'
import { apiCoverageTodo, productRoadmap } from './world/roadmap'

const numberFormatter = new Intl.NumberFormat('en-US')

export default async function Home() {
  const [healthResult, configResult, solarSystemsResult, constellationsResult] =
    await Promise.all([
      getWorldHealth(),
      getWorldConfig(),
      listSolarSystems(),
      listConstellations(),
    ])

  const overviewCards = [
    {
      title: 'Atlas',
      href: '/atlas',
      detail: 'Search start and destination systems, then compute a gate route on the server.',
    },
    {
      title: 'Verify',
      href: '/verify',
      detail: 'Generate POD-backed cards and share them with a verification trail.',
    },
    {
      title: 'Fleet',
      href: '/fleet',
      detail: 'Turn ship stats into a clean comparison surface for planning.',
    },
    {
      title: 'Codex',
      href: '/codex',
      detail: 'Browse item types with logistics-relevant metadata first.',
    },
    {
      title: 'Tribes',
      href: '/tribes',
      detail: 'Keep a compact intel board for tribe tags, tax, and links.',
    },
    {
      title: 'Jumps',
      href: '/jumps',
      detail: 'Gracefully unlock private travel history when the server token exists.',
    },
  ] as const

  return (
    <>
      <EnvConfigWarning />
      <NetworkSupportChecker />
      <div className="flex w-full max-w-6xl flex-col gap-6 px-3">
        <section className="grid gap-4 rounded-[2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(77,162,255,0.18),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.88),rgba(15,23,42,0.82))] md:grid-cols-[1.15fr_0.85fr] md:p-8">
          <div className="space-y-5">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs uppercase tracking-[0.3em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200">
              World API cockpit
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">
                A multi-page frontend for route search, verified cards, and
                game intelligence.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                The product surface is now organized by task. Overview stays
                lightweight, while Atlas, Verify, Fleet, Codex, Tribes, Jumps,
                and TODO each get their own page.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {productRoadmap.map((item) => (
                <article
                  key={item.title}
                  className="rounded-3xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="text-base font-medium text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h2>
                    <span className="rounded-full border border-slate-200/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <article className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Health
                </span>
                <Activity className="h-5 w-5 text-slate-700 dark:text-slate-100" />
              </div>
              <div className="text-3xl font-semibold text-slate-950 dark:text-white">
                {healthResult.error == null ? 'Healthy' : 'Attention'}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {healthResult.error ?? 'World API reachable and ready for page-level feature loading.'}
              </p>
            </article>
            <article className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Universe
                </span>
                <Orbit className="h-5 w-5 text-slate-700 dark:text-slate-100" />
              </div>
              <div className="text-3xl font-semibold text-slate-950 dark:text-white">
                {solarSystemsResult.data?.metadata.total
                  ? `${numberFormatter.format(solarSystemsResult.data.metadata.total)} systems`
                  : 'Unavailable'}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {constellationsResult.data?.metadata.total
                  ? `${numberFormatter.format(constellationsResult.data.metadata.total)} constellations available for atlas and routing context.`
                  : constellationsResult.error ?? 'Constellation data unavailable'}
              </p>
            </article>
            <article className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Verify
                </span>
                <ShieldCheck className="h-5 w-5 text-slate-700 dark:text-slate-100" />
              </div>
              <div className="text-3xl font-semibold text-slate-950 dark:text-white">
                {configResult.data?.[0]?.podPublicSigningKey?.slice(0, 12) ??
                  'Unavailable'}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                POD signing key is exposed on overview so operators can spot environment issues early.
              </p>
            </article>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {overviewCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-[1.75rem] border border-slate-200/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_24px_70px_rgba(14,165,233,0.12)] dark:border-slate-800 dark:bg-slate-950/75 dark:hover:border-sky-700"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
                  {card.title}
                </h2>
                <Boxes className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              </div>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                {card.detail}
              </p>
            </Link>
          ))}
        </section>

        <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/75">
          <div className="mb-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
              TODO
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              What this iteration is optimizing for
            </h2>
          </div>
          <div className="grid gap-3">
            {apiCoverageTodo.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm leading-7 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
