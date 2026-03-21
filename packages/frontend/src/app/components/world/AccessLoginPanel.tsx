'use client'

import {
  useCurrentAccount,
  useCurrentWallet,
  useSignPersonalMessage,
} from '@mysten/dapp-kit'
import { Button } from '@radix-ui/themes'
import { KeyRound, LoaderCircle, ShieldCheck, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

type AuthUser = {
  id: string
  walletAddress: string
  walletName: string | null
}

const encoder = new TextEncoder()

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
          signature: signed.signature,
        }),
      })

      await parseJsonResponse(loginResponse)
      await loadSession()
      setSuccessMessage('Wallet authenticated. API Access page is unlocked.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to sign in')
    } finally {
      setIsSubmitting(false)
    }
  }

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
        {!user ? (
          <Button
            onClick={handleLogin}
            disabled={!isConnected || isSubmitting}
            className="!h-12 !rounded-full !bg-[linear-gradient(135deg,#020617,#0ea5e9)] !px-6 !font-semibold !text-white !shadow-[0_18px_42px_rgba(14,165,233,0.28)] transition hover:!translate-y-[-1px] hover:!shadow-[0_24px_48px_rgba(14,165,233,0.34)] disabled:!translate-y-0 disabled:!opacity-60"
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Wallet className="h-4 w-4" />
            )}
            {isSubmitting ? 'Waiting For Signature' : 'Sign In With Wallet'}
          </Button>
        ) : (
          <Link
            href="/access"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-sky-300 bg-[linear-gradient(135deg,rgba(14,165,233,0.18),rgba(59,130,246,0.24))] px-6 text-sm font-semibold text-sky-950 shadow-[0_18px_40px_rgba(14,165,233,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(14,165,233,0.24)] dark:border-sky-700 dark:text-sky-50"
          >
            <ShieldCheck className="h-4 w-4" />
            Open API Access
          </Link>
        )}
      </div>

      {user ? (
        <div className="mt-4 rounded-[1.4rem] border border-emerald-300/70 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(209,250,229,0.92))] px-4 py-4 text-sm text-emerald-900 shadow-[0_14px_32px_rgba(16,185,129,0.12)] dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
          Session ready for {user.walletName ?? truncateValue(user.walletAddress)}. API key
          management is available now.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-[1.4rem] border border-red-300/70 bg-[linear-gradient(135deg,rgba(254,242,242,0.96),rgba(254,226,226,0.92))] px-4 py-3 text-sm font-medium text-red-800 shadow-[0_14px_30px_rgba(239,68,68,0.08)] dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-[1.4rem] border border-emerald-300/70 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(209,250,229,0.92))] px-4 py-3 text-sm font-medium text-emerald-800 shadow-[0_14px_30px_rgba(16,185,129,0.08)] dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
          {successMessage}
        </div>
      ) : null}
    </section>
  )
}
