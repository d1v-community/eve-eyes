'use client'

import {
  useCurrentWallet,
} from '@mysten/dapp-kit'
import { Button, TextField } from '@radix-ui/themes'
import {
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TimerReset,
} from 'lucide-react'
import { startTransition, useCallback, useEffect, useState } from 'react'

type AuthUser = {
  id: string
  walletAddress: string
  walletName: string | null
  chain: string
  createdAt: string
  updatedAt: string
  lastSeenAt: string
}

type ApiKeyRecord = {
  id: string
  userId: string
  name: string
  keyPrefix: string
  rateLimitTps: number
  createdAt: string
  updatedAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(value: string | null) {
  if (!value) {
    return 'Never'
  }

  return dateTimeFormatter.format(new Date(value))
}

function truncateValue(value: string, start = 8, end = 6) {
  if (value.length <= start + end + 3) {
    return value
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`
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

export default function JumpsAccessPanel() {
  const { currentWallet } = useCurrentWallet()
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authType, setAuthType] = useState<'anonymous' | 'jwt' | 'apiKey'>('anonymous')
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([])
  const [apiKeyName, setApiKeyName] = useState('Indexer access')
  const [latestCreatedApiKey, setLatestCreatedApiKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadSession = useCallback(async () => {
    setIsRefreshing(true)

    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
      })

      if (response.status === 401) {
        setUser(null)
        setAuthType('anonymous')
        setApiKeys([])
        return
      }

      const payload = await parseJsonResponse(response)
      setUser(payload.user)
      setAuthType(payload.auth?.type ?? 'anonymous')
    } finally {
      setIsRefreshing(false)
      setIsBootstrapping(false)
    }
  }, [])

  const loadApiKeys = useCallback(async () => {
    const response = await fetch('/api/auth/api-keys', {
      cache: 'no-store',
    })

    if (response.status === 401) {
      setApiKeys([])
      return
    }

    const payload = await parseJsonResponse(response)
    setApiKeys(payload.apiKeys ?? [])
  }, [])

  useEffect(() => {
    startTransition(() => {
      loadSession().catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load session')
      })
    })
  }, [loadSession])

  useEffect(() => {
    if (!user) {
      return
    }

    startTransition(() => {
      loadApiKeys().catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load API keys')
      })
    })
  }, [loadApiKeys, user])

  async function handleCreateApiKey() {
    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: apiKeyName,
        }),
      })
      const payload = await parseJsonResponse(response)

      setLatestCreatedApiKey(payload.apiKey)
      await loadApiKeys()
      setSuccessMessage('API key created. Copy it now; the full value is only shown once.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create API key')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRevokeApiKey(apiKeyId: string) {
    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`/api/auth/api-keys/${apiKeyId}`, {
        method: 'DELETE',
      })

      await parseJsonResponse(response)
      await loadApiKeys()
      setSuccessMessage('API key revoked.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to revoke API key')
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeApiKeyCount = apiKeys.filter((item) => item.revokedAt == null).length

  return (
    <section id="api-access" className="grid gap-6 scroll-mt-32 xl:grid-cols-[0.95fr_1.05fr]">
      <article className="rounded-[2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.94))] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(15,23,42,0.86))]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/80 px-3 py-1.5 text-xs uppercase tracking-[0.28em] text-sky-700 shadow-[0_10px_24px_rgba(14,165,233,0.08)] dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
            <LockKeyhole className="h-3.5 w-3.5" />
            Access
          </div>
          <Button
            type="button"
            variant="soft"
            onClick={() => {
              setErrorMessage(null)
              setSuccessMessage(null)
              startTransition(() => {
                Promise.all([loadSession(), user ? loadApiKeys() : Promise.resolve()]).catch(
                  (error) => {
                    setErrorMessage(
                      error instanceof Error ? error.message : 'Failed to refresh session'
                    )
                  }
                )
              })
            }}
            disabled={isRefreshing || isSubmitting}
            className="!h-11 !rounded-full !border !border-slate-200/80 !bg-white/90 !px-4 !font-semibold !text-slate-700 !shadow-[0_14px_32px_rgba(15,23,42,0.08)] transition hover:!translate-y-[-1px] hover:!bg-white dark:!border-slate-700 dark:!bg-slate-950/55 dark:!text-slate-100"
          >
            {isRefreshing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>

        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white md:text-4xl">
          API Keys
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          JWT for browser sessions. API keys for automation.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/55">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Session
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
              {isBootstrapping ? 'Loading' : authType === 'jwt' ? 'Authenticated' : 'Anonymous'}
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {authType === 'jwt'
                ? 'JWT cookie and bearer token are both accepted.'
                : 'Connect and sign once to unlock protected pages.'}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/55">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Wallet
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
              {user?.walletAddress ? truncateValue(user.walletAddress) : 'Not connected'}
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {user?.walletName ?? currentWallet?.name ?? 'Wallet-authenticated session'}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/55">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Active API keys
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
              {activeApiKeyCount}
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Revoked keys stop working immediately.
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-[1.3rem] border border-red-300/70 bg-red-50/90 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 rounded-[1.3rem] border border-emerald-300/70 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        {user ? (
          <div className="mt-5 rounded-[1.55rem] border border-slate-200/70 bg-white/85 p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/55">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4" />
              Current User
            </div>
            <div className="mt-3 text-base font-medium text-slate-950 dark:text-white">
              {user.walletName ?? 'Wallet session'}
            </div>
            <div className="mt-1 break-all text-sm text-slate-600 dark:text-slate-300">
              {user.walletAddress}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                Created {formatDate(user.createdAt)}
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                Last seen {formatDate(user.lastSeenAt)}
              </div>
            </div>
          </div>
        ) : null}
      </article>

      <article className="rounded-[2rem] border border-slate-200/70 bg-white/92 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
              <KeyRound className="h-4 w-4" />
              API Keys
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              Create and manage keys
            </h3>
          </div>
          <div className="rounded-full border border-slate-200/80 bg-slate-50/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            {activeApiKeyCount} active
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-[1.6rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.97),rgba(241,245,249,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:grid-cols-[1fr_auto] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(2,6,23,0.88))]">
          <TextField.Root
            value={apiKeyName}
            onChange={(event) => setApiKeyName(event.target.value)}
            placeholder="Indexer access"
            disabled={!user || isSubmitting}
            className="!h-12 !rounded-full [&_input]:!rounded-full [&_input]:!border-0 [&_input]:!bg-white [&_input]:!px-4 [&_input]:!text-[15px] [&_input]:!shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_input]:!bg-slate-950/70"
          />
          <Button
            onClick={handleCreateApiKey}
            disabled={!user || isSubmitting}
            className="!h-12 !rounded-full !bg-[linear-gradient(135deg,#020617,#0ea5e9)] !px-5 !font-semibold !text-white !shadow-[0_18px_40px_rgba(14,165,233,0.26)] transition hover:!translate-y-[-1px] hover:!shadow-[0_22px_44px_rgba(14,165,233,0.32)] disabled:!translate-y-0 disabled:!opacity-60"
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {isSubmitting ? 'Creating' : 'Create Key'}
          </Button>
        </div>

        {latestCreatedApiKey ? (
          <div className="mt-4 rounded-[1.5rem] border border-emerald-300/70 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(209,250,229,0.94))] p-4 shadow-[0_16px_34px_rgba(16,185,129,0.08)] dark:border-emerald-900/70 dark:bg-emerald-950/25">
            <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
              Copy now
            </div>
            <div className="mt-2 break-all font-mono text-sm text-emerald-900 dark:text-emerald-100">
              {latestCreatedApiKey}
            </div>
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {apiKeys.length > 0 ? (
            apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="rounded-[1.55rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.92))] p-4 shadow-[0_16px_34px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.86))]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-950 dark:text-white">
                      {apiKey.name}
                    </div>
                    <div className="mt-1 font-mono text-sm text-slate-600 dark:text-slate-300">
                      {apiKey.keyPrefix}...
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="rounded-full border border-slate-200/80 bg-white/75 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                      {apiKey.rateLimitTps} TPS
                    </div>
                    <Button
                      variant="soft"
                      color="red"
                      onClick={() => handleRevokeApiKey(apiKey.id)}
                      disabled={Boolean(apiKey.revokedAt) || isSubmitting}
                      className="!h-10 !rounded-full !border !border-rose-200 !bg-rose-50 !px-4 !font-semibold !text-rose-700 transition hover:!translate-y-[-1px] hover:!bg-rose-100 disabled:!opacity-45 dark:!border-rose-900/70 dark:!bg-rose-950/35 dark:!text-rose-100"
                    >
                      <TimerReset className="h-4 w-4" />
                      Revoke
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
                    Created {formatDate(apiKey.createdAt)}
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
                    Last used {formatDate(apiKey.lastUsedAt)}
                  </div>
                </div>

                {apiKey.revokedAt ? (
                  <div className="mt-3 rounded-2xl border border-red-300/70 bg-red-50/80 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/25 dark:text-red-300">
                    Revoked at {formatDate(apiKey.revokedAt)}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/60 px-4 py-5 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-300">
              {user
                ? 'No API keys yet. Create one to call page 4 and beyond from your own scripts.'
                : 'Sign in first, then create an API key for server-to-server access.'}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-[1.6rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.97),rgba(241,245,249,0.94))] p-4 shadow-[0_16px_34px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.82),rgba(15,23,42,0.8))]">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
            Examples
          </div>
          <pre className="mt-3 overflow-x-auto rounded-[1.2rem] border border-slate-200/80 bg-slate-950 px-4 py-3 text-xs leading-6 text-slate-100 dark:border-slate-800">
{`curl '/api/indexer/transaction-blocks?page=1&pageSize=20'

curl '/api/indexer/transaction-blocks?page=4&pageSize=20' \\
  -H 'Authorization: Bearer <jwt>'

curl '/api/indexer/move-calls?page=4&pageSize=20&moduleName=world' \\
  -H 'x-api-key: <api-key>'`}
          </pre>
        </div>
      </article>
    </section>
  )
}
