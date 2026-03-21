'use client'

import {
  ConnectModal,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
} from '@mysten/dapp-kit'
import { Button, IconButton } from '@radix-ui/themes'
import {
  LoaderCircleIcon,
  LogOutIcon,
  PlugZapIcon,
  WalletIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const truncateAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`

const CustomConnectButton = () => {
  const router = useRouter()
  const currentAccount = useCurrentAccount()
  const { currentWallet, connectionStatus, isConnected, isConnecting } =
    useCurrentWallet()
  const { mutateAsync: disconnectWallet, isPending: isDisconnecting } =
    useDisconnectWallet()
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const safeConnectionStatus = hasMounted ? connectionStatus : 'disconnected'
  const safeIsConnected = hasMounted && isConnected
  const safeIsConnecting = hasMounted && isConnecting
  const safeCurrentWalletName = hasMounted ? currentWallet?.name : null
  const safeCurrentAccount = hasMounted ? currentAccount : null

  const statusConfig = {
    disconnected: {
      label: '',
      detail: 'Connect wallet',
      icon: WalletIcon,
      dotClassName: 'sds-status-dot sds-status-dot-disconnected',
      iconClassName: 'text-slate-500',
    },
    connecting: {
      label: 'Connecting',
      detail: 'Approve in wallet',
      icon: LoaderCircleIcon,
      dotClassName: 'sds-status-dot sds-status-dot-connecting',
      iconClassName: 'text-amber-500',
    },
    connected: {
      label: safeCurrentWalletName || 'Wallet connected',
      detail: safeCurrentAccount ? truncateAddress(safeCurrentAccount.address) : 'Active',
      icon: PlugZapIcon,
      dotClassName: 'sds-status-dot sds-status-dot-connected',
      iconClassName: 'text-emerald-500',
    },
  } as const

  const status = statusConfig[safeConnectionStatus]
  const StatusIcon = status.icon

  async function handleDisconnect() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        cache: 'no-store',
      })
    } catch (error) {
      console.error('Failed to clear auth session before wallet disconnect.', error)
    }

    try {
      await disconnectWallet()
    } finally {
      router.refresh()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <ConnectModal
        trigger={
          <Button
            variant="surface"
            size="3"
            className="group cursor-pointer !h-auto !rounded-full !bg-white/78 !px-2.5 !py-1.5 text-left !shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-md transition-all duration-300 hover:!bg-white/92 sm:!px-3 sm:!py-2 dark:!bg-slate-950/55 dark:hover:!bg-slate-950/72"
          >
            <span className="flex items-center gap-2 sm:gap-3">
              <span className="sds-status-icon-shell">
                <span className={status.dotClassName} />
                <StatusIcon
                  className={`h-4 w-4 ${status.iconClassName} ${safeIsConnecting ? 'animate-spin' : ''}`}
                />
              </span>

              {safeConnectionStatus === 'disconnected' ? (
                <span className="text-sm font-medium text-slate-900 dark:text-slate-50">
                  <span className="sm:hidden">Connect</span>
                  <span className="hidden sm:inline">{status.detail}</span>
                </span>
              ) : (
                <span className="flex flex-col leading-tight">
                  <span className="hidden text-[0.68rem] uppercase tracking-[0.24em] text-slate-500 transition-colors duration-300 group-hover:text-slate-700 sm:inline dark:text-slate-400 dark:group-hover:text-slate-200">
                    {status.label}
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-50">
                    {status.detail}
                  </span>
                </span>
              )}
            </span>
          </Button>
        }
      />

      {safeIsConnected && safeCurrentAccount ? (
        <IconButton
          type="button"
          variant="soft"
          size="3"
          radius="full"
          aria-label="Disconnect wallet"
          className="cursor-pointer !h-9 !w-9 !bg-white/68 !text-slate-600 !shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-md transition-all duration-300 hover:!bg-white/88 hover:!text-slate-900 sm:!h-10 sm:!w-10 dark:!bg-slate-950/48 dark:!text-slate-300 dark:hover:!bg-slate-950/72 dark:hover:!text-white"
          onClick={() => void handleDisconnect()}
          disabled={isDisconnecting}
        >
          <LogOutIcon className="h-4 w-4" />
        </IconButton>
      ) : null}
    </div>
  )
}

export default CustomConnectButton
