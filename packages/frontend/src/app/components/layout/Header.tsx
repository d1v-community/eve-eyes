'use client'

import { useCurrentWallet } from '@mysten/dapp-kit'
import Balance from '@suiware/kit/Balance'
import NetworkType from '@suiware/kit/NetworkType'
import { Compass, FolderKanban, KeyRound, Radar } from 'lucide-react'
import { APP_NAME } from '../../config/main'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import CustomConnectButton from '../CustomConnectButton'
import LogoMark from '../LogoMark'
import { headerNavigation, operationsNavigation } from '~~/world/roadmap'

type HeaderHref = (typeof headerNavigation)[number]['href']

const navIcons = {
  '/': Compass,
  '/atlas': Radar,
  '/fleet': FolderKanban,
} satisfies Record<HeaderHref, typeof Compass>

const operationRoutes = new Set<string>(operationsNavigation.map((item) => item.href))

const Header = () => {
  const { isConnected } = useCurrentWallet()
  const pathname = usePathname()
  const isApiAccessActive = pathname === '/access'
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  return (
    <header className="supports-backdrop-blur:bg-white/60 dark:border-slate-50/1 sticky top-0 z-40 flex w-full justify-center border-b border-slate-900/10 bg-white/90 px-3 py-3 backdrop-blur transition-colors duration-500 dark:border-slate-50/10 dark:bg-slate-950/70">
      <div className="flex w-full max-w-6xl flex-col gap-4">
        <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-4">
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center gap-2 text-sds-dark outline-none hover:no-underline sm:flex-none sm:gap-3 dark:text-sds-light"
          >
            <LogoMark className="h-9 w-9 shrink-0 sm:h-12 sm:w-12" title="Logo" />
            <div className="min-w-0">
              <div className="font-display truncate pt-0.5 text-base font-semibold tracking-[-0.03em] sm:pt-1 sm:text-2xl">
                {APP_NAME}
              </div>
              <div className="font-body truncate text-[10px] uppercase tracking-[0.22em] text-slate-500 sm:text-xs sm:tracking-[0.28em] dark:text-slate-400">
                Look on Chain
              </div>
            </div>
          </Link>

          <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1.5 sm:gap-3">
            <div className="flex origin-right scale-[0.9] flex-row items-center justify-center gap-2 sm:scale-100 sm:gap-3">
              <Balance />
              {hasMounted && isConnected ? <NetworkType /> : null}
            </div>

            <div className="sds-connect-button-container shrink-0">
              <CustomConnectButton />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto pb-1">
          <nav className="flex min-w-max items-center gap-2">
            {headerNavigation.map((item) => {
              const Icon = navIcons[item.href as HeaderHref] ?? Compass
              const isActive =
                item.href === '/fleet'
                  ? operationRoutes.has(pathname)
                  : pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-body inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold tracking-[0.01em] transition ${isActive
                      ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                      : 'border-slate-200/80 bg-white/75 text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300'
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
            <Link
              href="/access"
              className={`font-display inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] shadow-[0_10px_24px_rgba(245,158,11,0.22)] transition hover:-translate-y-0.5 ${isApiAccessActive
                  ? 'border-amber-400 bg-amber-200 text-amber-950 dark:border-amber-500 dark:bg-amber-500/35 dark:text-amber-50'
                  : 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-500/20 dark:text-amber-100 dark:hover:bg-amber-500/30'
                }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>API Access</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
export default Header
