'use client'

import { Copy } from 'lucide-react'
import { notification } from '~~/helpers/notification'

type Props = {
  walletAddress: string
  alwaysVisible?: boolean
}

export default function LeaderboardOwnerCopyButton({
  walletAddress,
  alwaysVisible = false,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(walletAddress)
        notification.success('Wallet copied to clipboard')
      }}
      className={`shrink-0 rounded-full border border-slate-200/80 bg-white/80 p-1.5 text-slate-400 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-500 dark:hover:border-sky-700 dark:hover:text-sky-300 ${
        alwaysVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
      aria-label="Copy owner wallet"
      title="Copy wallet"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  )
}
