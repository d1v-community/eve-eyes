'use client'

import { useCurrentWallet } from '@mysten/dapp-kit'
import Balance from '@suiware/kit/Balance'
import NetworkType from '@suiware/kit/NetworkType'
import { Compass, FolderKanban, Radar } from 'lucide-react'
import { APP_NAME } from '../../config/main'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from '../../assets/logo.svg'
import CustomConnectButton from '../CustomConnectButton'
import { headerNavigation, operationsNavigation } from '~~/world/roadmap'

const navIcons = {
  '/': Compass,
  '/atlas': Radar,
  '/fleet': FolderKanban,
} as const

const operationRoutes = new Set<string>(operationsNavigation.map((item) => item.href))

const Header = () => {
  const { isConnected } = useCurrentWallet()
  const pathname = usePathname()

  return (
    <header className="supports-backdrop-blur:bg-white/60 dark:border-slate-50/1 sticky top-0 z-40 flex w-full justify-center border-b border-slate-900/10 bg-white/90 px-3 py-3 backdrop-blur transition-colors duration-500 dark:border-slate-50/10 dark:bg-slate-950/70">
      <div className="flex w-full max-w-6xl flex-col gap-4">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Link
            href="/"
            className="flex flex-col items-center justify-center gap-1 text-sds-dark outline-none hover:no-underline sm:flex-row dark:text-sds-light"
          >
            <Image
              width={40}
              height={40}
              src={Logo}
              alt="Logo"
              className="h-12 w-12"
            />
            <div>
              <div className="pt-1 text-xl sm:text-2xl">{APP_NAME}</div>
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                World API cockpit
              </div>
            </div>
          </Link>

          <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <div className="flex flex-row items-center justify-center gap-3">
              <Balance />
              {isConnected ? <NetworkType /> : null}
            </div>

            <div className="sds-connect-button-container">
              <CustomConnectButton />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto pb-1">
          <nav className="flex min-w-max items-center gap-2">
            {headerNavigation.map((item) => {
              const Icon = navIcons[item.href]
              const isActive =
                item.href === '/fleet'
                  ? operationRoutes.has(pathname)
                  : pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                      : 'border-slate-200/80 bg-white/75 text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs uppercase tracking-[0.24em] text-amber-700 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-300">
              Jumps require server token
            </span>
          </nav>
        </div>
      </div>
    </header>
  )
}
export default Header
