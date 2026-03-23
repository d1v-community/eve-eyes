'use client'

import {
  ConnectModal,
  useCurrentAccount,
  useCurrentWallet,
  useSignPersonalMessage,
} from '@mysten/dapp-kit'
import { Button } from '@radix-ui/themes'
import { KeyRound, LoaderCircle, ShieldCheck, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { notification } from '../../helpers/notification'
import JumpsAccessPanel from './JumpsAccessPanel'

type AuthUser = {
  id: string
  walletAddress: string
  walletName: string | null
}

const encoder = new TextEncoder()

function encodeBase64(value: Uint8Array) {
  let result = ''

  for (const byte of value) {
    result += String.fromCharCode(byte)
  }

  return btoa(result)
}

async function parseJsonResponse(response: Response) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      typeof payload?.error === 'string' ? payload.error : `Request failed: ${response.status}`
    )
  }

  return payload
}

function truncateValue(value: string, start = 8, end = 6) {
  if (value.length <= start + end + 3) {
    return value
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`
}

export default function AccessLoginPanel() {
  const currentAccount = useCurrentAccount()
  const { currentWallet, isConnected } = useCurrentWallet()
  const signPersonalMessage = useSignPersonalMessage()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadSession = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
      })

      if (response.status === 401) {
        setUser(null)
        return
      }

      const payload = await parseJsonResponse(response)
      setUser(payload.user)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSession().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load session')
    })
  }, [loadSession])

  async function handleLogin() {
    if (!currentAccount?.address) {
      setErrorMessage('Connect a wallet before signing in.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    const loginToastId = notification.loading(
      isConnected ? 'Sign the message in your wallet to continue.' : 'Connect your wallet.'
    )

    try {
      const challengeResponse = await fetch('/api/auth/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: currentAccount.address,
        }),
      })
      const challengePayload = await parseJsonResponse(challengeResponse)
      const signed = await signPersonalMessage.mutateAsync({
        message: encoder.encode(challengePayload.challenge.message),
      })
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          challengeId: challengePayload.challenge.id,
          walletAddress: currentAccount.address,
          walletName: currentWallet?.name ?? null,
          bytes: signed.bytes,
          publicKey: encodeBase64(new Uint8Array(currentAccount.publicKey)),
          signature: signed.signature,
        }),
      })

      await parseJsonResponse(loginResponse)
      await loadSession()
      setSuccessMessage('Wallet authenticated. API Access page is unlocked.')
      notification.success('Signature verified. API key access is unlocked.', loginToastId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign in'
      setErrorMessage(message)
      notification.error(error instanceof Error ? error : null, message, loginToastId)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleProtectedAccessClick() {
    notification.error(null, 'Please log in and complete the wallet signature first.')
  }

  if (user) {
    return <JumpsAccessPanel />
  }

  const ctaLabel = !isConnected
    ? 'Login With Wallet'
    : isSubmitting
      ? 'Waiting For Signature'
      : 'Sign Message To Unlock'

  const ctaIcon = isSubmitting ? (
    <LoaderCircle className="h-4 w-4 animate-spin" />
  ) : (
    <Wallet className="h-4 w-4" />
  )

  return (
    <section
      id="access-login"
      className="rounded-[2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.9),rgba(15,23,42,0.84))]"
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-sky-800 shadow-[0_10px_24px_rgba(14,165,233,0.12)] dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-100">
        <KeyRound className="h-3.5 w-3.5" />
        Sign In
      </div>

      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white md:text-4xl">
        Unlock API access with your wallet.
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
        One signature. No on-chain transaction.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/55">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Session
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
            {isLoading ? 'Loading' : user ? 'Authenticated' : 'Locked'}
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {user ? 'JWT cookie is active in this browser.' : 'No API management without login.'}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/55">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Wallet
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
            {currentAccount?.address ? truncateValue(currentAccount.address) : 'Not connected'}
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {currentWallet?.name ?? 'Use the wallet button in the header.'}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/55">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Destination
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
            /access
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Protected page for API keys and usage guidance.
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {!isConnected ? (
          <ConnectModal
            trigger={
              <Button className="cursor-pointer !h-12 !rounded-full !bg-[linear-gradient(135deg,#020617,#0ea5e9)] !px-6 !font-semibold !text-white !shadow-[0_18px_42px_rgba(14,165,233,0.28)] transition hover:!translate-y-[-1px] hover:!shadow-[0_24px_48px_rgba(14,165,233,0.34)] disabled:!translate-y-0 disabled:!opacity-60">
                {ctaIcon}
                {ctaLabel}
              </Button>
            }
          />
        ) : (
          <Button
            onClick={handleLogin}
            disabled={isSubmitting}
            className="cursor-pointer !h-12 !rounded-full !bg-[linear-gradient(135deg,#020617,#0ea5e9)] !px-6 !font-semibold !text-white !shadow-[0_18px_42px_rgba(14,165,233,0.28)] transition hover:!translate-y-[-1px] hover:!shadow-[0_24px_48px_rgba(14,165,233,0.34)] disabled:!translate-y-0 disabled:!opacity-60"
          >
            {ctaIcon}
            {ctaLabel}
          </Button>
        )}
        <button
          type="button"
          onClick={handleProtectedAccessClick}
          className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-sky-300/90 bg-[linear-gradient(135deg,rgba(224,242,254,0.96),rgba(186,230,253,0.92))] px-6 text-sm font-semibold text-sky-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_40px_rgba(14,165,233,0.18)] transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-[0_22px_44px_rgba(14,165,233,0.24)] dark:border-sky-700/80 dark:bg-[linear-gradient(135deg,rgba(8,47,73,0.72),rgba(30,64,175,0.48))] dark:text-sky-50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_22px_44px_rgba(14,165,233,0.16)] dark:hover:border-sky-500 dark:hover:bg-[linear-gradient(135deg,rgba(8,47,73,0.84),rgba(30,64,175,0.6))]"
        >
          <ShieldCheck className="h-4 w-4" />
          Open API Access
        </button>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-[1.4rem] border border-red-300/70 bg-[linear-gradient(135deg,rgba(254,242,242,0.96),rgba(254,226,226,0.92))] px-4 py-3 text-sm font-medium text-red-800 shadow-[0_14px_30px_rgba(239,68,68,0.08)] dark:border-red-900/80 dark:bg-[linear-gradient(135deg,rgba(69,10,10,0.92),rgba(44,9,18,0.88))] dark:text-red-100 dark:shadow-[0_18px_36px_rgba(127,29,29,0.22)]">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-[1.4rem] border border-emerald-300/70 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(209,250,229,0.92))] px-4 py-3 text-sm font-medium text-emerald-800 shadow-[0_14px_30px_rgba(16,185,129,0.08)] dark:border-emerald-900/80 dark:bg-[linear-gradient(135deg,rgba(6,44,30,0.92),rgba(6,30,34,0.88))] dark:text-emerald-100 dark:shadow-[0_18px_36px_rgba(6,78,59,0.2)]">
          {successMessage}
        </div>
      ) : null}
    </section>
  )
}
