'use client'

import { useCurrentAccount } from '@mysten/dapp-kit'
import { Link } from '@radix-ui/themes'
import Faucet from '@suiware/kit/Faucet'
import { HeartIcon, KeyRound, SearchIcon } from 'lucide-react'
import NextLink from 'next/link'
import {
  CONTRACT_PACKAGE_VARIABLE_NAME,
  EXPLORER_URL_VARIABLE_NAME,
} from '../../config/network'
import { packageUrl } from '../../helpers/network'
import { notification } from '../../helpers/notification'
import useNetworkConfig from '../../hooks/useNetworkConfig'
import ThemeSwitcher from '../ThemeSwitcher'

const Footer = () => {
  const { useNetworkVariables } = useNetworkConfig()
  const networkVariables = useNetworkVariables()
  const explorerUrl = networkVariables[EXPLORER_URL_VARIABLE_NAME]
  const packageId = networkVariables[CONTRACT_PACKAGE_VARIABLE_NAME]
  const currentAccount = useCurrentAccount()

  return (
    <footer className="flex w-full flex-col items-center justify-between gap-3 p-3 sm:flex-row sm:items-end">
      <div className="flex flex-row gap-3 lg:w-1/3">
        {currentAccount != null && (
          <>
            <Faucet
              onError={notification.error}
              onSuccess={notification.success}
            />
            <Link
              href={packageUrl(explorerUrl, packageId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-row items-center gap-1"
              highContrast={true}
            >
              <SearchIcon className="h-4 w-4" />
              <span>Block Explorer</span>
            </Link>
          </>
        )}
      </div>

      <div className="flex flex-grow items-center justify-center text-center text-sm opacity-80">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span>Thanks to</span>
          <HeartIcon className="h-4 w-4" />
          <Link
            href="https://x.com/0xHOH"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-100 dark:hover:text-white"
            highContrast={true}
          >
            @0xHOH
          </Link>
          <span>and</span>
          <Link
            href="https://x.com/d1v_lab"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-100 dark:hover:text-white"
            highContrast={true}
          >
            @d1v_lab
          </Link>
        </div>
      </div>

      <div className="flex flex-row items-center justify-end gap-3 lg:w-1/3">
        <NextLink
          href="/access"
          className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-sky-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-900 shadow-[0_10px_24px_rgba(14,165,233,0.18)] transition hover:-translate-y-0.5 hover:bg-sky-200 dark:border-sky-700 dark:bg-sky-500/15 dark:text-sky-100 dark:hover:bg-sky-500/25"
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Manage API</span>
        </NextLink>
        <ThemeSwitcher />
      </div>
    </footer>
  )
}
export default Footer
