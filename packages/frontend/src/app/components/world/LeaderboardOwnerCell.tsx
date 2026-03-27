import { ArrowUpRight } from 'lucide-react'
import { TESTNET_EXPLORER_URL } from '~~/config/network'
import { accountUrl } from '~~/helpers/network'
import LeaderboardOwnerCopyButton from './LeaderboardOwnerCopyButton'

type Props = {
  tenant: string
  walletAddress: string | null
  variant?: 'compact' | 'hero'
}

function truncateWallet(value: string | null) {
  if (!value) {
    return 'Wallet unavailable'
  }

  if (value.length <= 18) {
    return value
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`
}

export default function LeaderboardOwnerCell({
  tenant,
  walletAddress,
  variant = 'compact',
}: Props) {
  const href = walletAddress ? accountUrl(TESTNET_EXPLORER_URL, walletAddress) : null
  const isHero = variant === 'hero'
  const walletClassName = isHero
    ? 'font-data text-[1.72rem] leading-tight tracking-[-0.02em] text-slate-950 dark:text-white xl:text-[1.84rem]'
    : 'font-data text-[15px] tracking-[0.01em] text-slate-700 dark:text-slate-200'

  return (
    <div className="min-w-0">
      <div className="group flex min-w-0 items-center gap-2">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`min-w-0 truncate underline-offset-4 transition hover:text-sky-700 hover:underline dark:hover:text-sky-300 ${walletClassName}`}
            title={walletAddress ?? undefined}
          >
            {truncateWallet(walletAddress)}
          </a>
        ) : (
          <div
            className={`min-w-0 truncate ${walletClassName}`}
            title="Wallet unavailable"
          >
            {truncateWallet(walletAddress)}
          </div>
        )}

        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`shrink-0 rounded-full border border-slate-200/80 bg-white/80 p-1.5 text-slate-400 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-500 dark:hover:border-sky-700 dark:hover:text-sky-300 ${
              isHero ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            aria-label="Open owner in explorer"
            title="Open in explorer"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        ) : null}

        {walletAddress ? (
          <LeaderboardOwnerCopyButton
            walletAddress={walletAddress}
            alwaysVisible={isHero}
          />
        ) : null}
      </div>

      <div className="font-display mt-1 text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
        {tenant}
      </div>
    </div>
  )
}
