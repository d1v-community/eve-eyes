'use client'

import {
  ArrowRightLeft,
  Binary,
  Crosshair,
  FolderKanban,
  Trophy,
  ShieldCheck,
  ShipWheel,
  Swords,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { operationsNavigation } from '~~/world/roadmap'

const navIcons = {
  '/fleet': ShipWheel,
  '/codex': Binary,
  '/tribes': Swords,
  '/verify': ShieldCheck,
  '/jumps': ArrowRightLeft,
  '/operations/killmails': Crosshair,
  '/leaderboards': Trophy,
  '/todo': FolderKanban,
} as const

type OperationsShellProps = {
  children: React.ReactNode
}

export default function OperationsShell({ children }: OperationsShellProps) {
  const pathname = usePathname()

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-3 lg:flex-row lg:items-start">
      <aside className="lg:sticky lg:w-72 lg:flex-none">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.9))] p-3 sm:p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.86),rgba(15,23,42,0.82))]">
          <div className="rounded-[1.5rem] border border-sky-200/80 bg-sky-50/70 p-3 sm:p-4 dark:border-sky-900/70 dark:bg-sky-950/30">
            <div className="text-xs uppercase tracking-[0.28em] text-sky-700 dark:text-sky-200">
              Operations
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Control stack
            </h2>
          </div>

          <nav className="-mx-1 mt-4 flex w-auto max-w-full gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 lg:mx-0 lg:grid lg:overflow-visible lg:px-0 lg:pb-0">
            {operationsNavigation.map((item) => {
              const Icon = navIcons[item.href]
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-fit max-w-full shrink-0 rounded-[1.4rem] border px-3 py-3 transition lg:w-auto lg:px-4 ${isActive
                    ? 'border-sky-300 bg-sky-50 text-sky-800 shadow-[0_12px_30px_rgba(77,162,255,0.16)] dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100'
                    : 'border-slate-200/70 bg-white/70 text-slate-700 hover:border-sky-300 hover:bg-sky-50/60 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200 dark:hover:border-sky-800 dark:hover:bg-sky-950/20'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="mt-0.5 rounded-xl border border-current/15 bg-white/70 p-2 dark:bg-slate-900/50">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="whitespace-nowrap font-medium">{item.label}</div>
                  </div>
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
