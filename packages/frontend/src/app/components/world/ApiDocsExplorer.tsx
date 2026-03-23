'use client'

import { useMemo, useState } from 'react'
import { Braces, Database, Globe2, KeyRound, Link2, UserRound } from 'lucide-react'

type ApiDoc = {
  id: string
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  title: string
  group: 'auth' | 'indexer' | 'world' | 'users'
  auth: 'public' | 'jwt' | 'jwt-or-api-key' | 'optional'
  summary: string
  notes: string[]
  params?: string[]
  response: string[]
  example: string
}

type ApiGroup = {
  id: ApiDoc['group']
  label: string
  icon: typeof KeyRound
  description: string
}

const API_GROUPS: ApiGroup[] = [
  {
    id: 'auth',
    label: 'Auth',
    icon: KeyRound,
    description: 'Wallet login, session inspection, and API key lifecycle.',
  },
  {
    id: 'indexer',
    label: 'Indexer',
    icon: Database,
    description: 'Indexed chain records, block drill-down, and move call inspection.',
  },
  {
    id: 'world',
    label: 'World',
    icon: Globe2,
    description: 'Route planning and world lookup endpoints used by atlas-style screens.',
  },
  {
    id: 'users',
    label: 'Users',
    icon: UserRound,
    description: 'Wallet user lookup and upsert helpers.',
  },
]

const API_DOCS: ApiDoc[] = [
  {
    id: 'auth-challenge',
    group: 'auth',
    method: 'POST',
    path: '/api/auth/challenge',
    title: 'Create Wallet Login Challenge',
    auth: 'public',
    summary: 'Creates a nonce-backed personal-sign message for a Sui wallet login flow.',
    params: ['body.walletAddress'],
    notes: [
      'Use this before `/api/auth/login`.',
      'The response includes `challenge.id`, `message`, `nonce`, and `expiresAt`.',
    ],
    response: ['challenge.id', 'challenge.walletAddress', 'challenge.message', 'challenge.expiresAt'],
    example: `curl '/api/auth/challenge' \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -d '{"walletAddress":"0xabc..."}'`,
  },
  {
    id: 'auth-login',
    group: 'auth',
    method: 'POST',
    path: '/api/auth/login',
    title: 'Verify Wallet Signature And Login',
    auth: 'public',
    summary: 'Verifies the signed challenge, returns a JWT, and sets the auth cookie.',
    params: ['body.challengeId', 'body.walletAddress', 'body.signature', 'body.walletName?', 'body.publicKey?'],
    notes: [
      'Returns both a JWT token and a session cookie.',
      'Supports serialized Sui signatures as well as raw base64 signatures plus `publicKey`.',
    ],
    response: ['token', 'expiresAt', 'user'],
    example: `curl '/api/auth/login' \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -d '{"challengeId":"1","walletAddress":"0xabc...","signature":"<signature>","publicKey":"<base64>"}'`,
  },
  {
    id: 'auth-logout',
    group: 'auth',
    method: 'POST',
    path: '/api/auth/logout',
    title: 'Clear Session Cookie',
    auth: 'optional',
    summary: 'Deletes the access-token cookie and returns `{ ok: true }`.',
    notes: ['Useful for browser logout flows.', 'No request body is required.'],
    response: ['ok'],
    example: `curl '/api/auth/logout' -X POST`,
  },
  {
    id: 'auth-me',
    group: 'auth',
    method: 'GET',
    path: '/api/auth/me',
    title: 'Inspect Current Session',
    auth: 'jwt',
    summary: 'Returns the authenticated user and auth mode for the current browser or bearer session.',
    notes: ['Requires a valid JWT cookie or `Authorization: Bearer <jwt>` header.'],
    response: ['auth.type', 'auth.userId', 'user'],
    example: `curl '/api/auth/me' \\
  -H 'Authorization: Bearer <jwt>'`,
  },
  {
    id: 'auth-api-keys-list',
    group: 'auth',
    method: 'GET',
    path: '/api/auth/api-keys',
    title: 'List API Keys',
    auth: 'jwt',
    summary: 'Lists the current user’s API keys, including prefix, limits, usage, and revoke state.',
    notes: ['Only JWT-authenticated users can manage keys.'],
    response: ['apiKeys[]'],
    example: `curl '/api/auth/api-keys' \\
  -H 'Authorization: Bearer <jwt>'`,
  },
  {
    id: 'auth-api-keys-create',
    group: 'auth',
    method: 'POST',
    path: '/api/auth/api-keys',
    title: 'Create API Key',
    auth: 'jwt',
    summary: 'Creates a new machine key and returns the full key exactly once.',
    params: ['body.name'],
    notes: ['The plaintext API key is shown only in the creation response.', 'Maximum active API keys are enforced server-side.'],
    response: ['apiKey', 'record'],
    example: `curl '/api/auth/api-keys' \\
  -X POST \\
  -H 'Authorization: Bearer <jwt>' \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"automation-bot"}'`,
  },
  {
    id: 'auth-api-keys-revoke',
    group: 'auth',
    method: 'DELETE',
    path: '/api/auth/api-keys/{id}',
    title: 'Revoke API Key',
    auth: 'jwt',
    summary: 'Revokes a key immediately so it can no longer authenticate protected endpoints.',
    params: ['path.id'],
    notes: ['Returns `404` if the key does not belong to the current user or no longer exists.'],
    response: ['record'],
    example: `curl '/api/auth/api-keys/12' \\
  -X DELETE \\
  -H 'Authorization: Bearer <jwt>'`,
  },
  {
    id: 'indexer-transaction-blocks',
    group: 'indexer',
    method: 'GET',
    path: '/api/indexer/transaction-blocks',
    title: 'List Transaction Blocks',
    auth: 'jwt-or-api-key',
    summary: 'Pages through indexed transaction blocks with exact-match filters.',
    params: ['page', 'pageSize', 'network', 'senderAddress', 'status', 'digest', 'transactionKind', 'checkpoint'],
    notes: [
      'Pages 1-3 are public. Page 4+ requires JWT or API key auth.',
      'Results are ordered by `transaction_time DESC, id DESC`.',
    ],
    response: ['items[]', 'pagination', 'auth.type'],
    example: `curl '/api/indexer/transaction-blocks?page=4&pageSize=20&status=success' \\
  -H 'Authorization: ApiKey <api-key>'`,
  },
  {
    id: 'indexer-transaction-block-detail',
    group: 'indexer',
    method: 'GET',
    path: '/api/indexer/transaction-blocks/{digest}',
    title: 'Get Transaction Block Detail',
    auth: 'public',
    summary: 'Returns the full indexed transaction payload, including raw content, effects, and events.',
    params: ['path.digest'],
    notes: ['Used by the transaction detail page after the tab opens.'],
    response: ['item.digest', 'item.rawContent', 'item.effects', 'item.events'],
    example: `curl '/api/indexer/transaction-blocks/3iL1saWuDmg7tq4YaEVKXt7r9tAMHm36f5v4Lt7eBDqf'`,
  },
  {
    id: 'indexer-transaction-move-calls',
    group: 'indexer',
    method: 'GET',
    path: '/api/indexer/transaction-blocks/{digest}/move-calls',
    title: 'List Parsed Move Calls For A Transaction',
    auth: 'public',
    summary: 'Loads all move calls under a single transaction and can optionally parse action summaries in batch.',
    params: ['path.digest', 'includeActionSummary'],
    notes: [
      'Use `includeActionSummary=1` to request parsed action text and entity classification.',
      'Batch parsing reuses the transaction’s shared context for better performance.',
    ],
    response: ['items[]'],
    example: `curl '/api/indexer/transaction-blocks/3iL1saWuDmg7tq4YaEVKXt7r9tAMHm36f5v4Lt7eBDqf/move-calls?includeActionSummary=1'`,
  },
  {
    id: 'indexer-move-calls',
    group: 'indexer',
    method: 'GET',
    path: '/api/indexer/move-calls',
    title: 'List Move Calls',
    auth: 'jwt-or-api-key',
    summary: 'Pages through indexed move call rows and supports exact-match filters across digest, package, module, function, and call index.',
    params: ['page', 'pageSize', 'network', 'senderAddress', 'status', 'txDigest', 'packageId', 'moduleName', 'functionName', 'callIndex', 'includeActionSummary?'],
    notes: [
      'Overview uses the lightweight mode without parsed actions.',
      'Set `includeActionSummary=1` only when you really need parsed action output.',
    ],
    response: ['items[]', 'pagination', 'auth.type'],
    example: `curl '/api/indexer/move-calls?page=4&pageSize=20&packageId=0x2&moduleName=world&functionName=jump' \\
  -H 'x-api-key: <api-key>'`,
  },
  {
    id: 'indexer-move-call-detail',
    group: 'indexer',
    method: 'GET',
    path: '/api/indexer/move-calls/{txDigest}/{callIndex}',
    title: 'Get Move Call Detail',
    auth: 'public',
    summary: 'Returns a single move call with parsed action text, parsed entities, and raw call payload.',
    params: ['path.txDigest', 'path.callIndex'],
    notes: ['Used by the move call detail page after it opens in a new tab.'],
    response: ['item.actionSummary', 'item.actionEntities', 'item.rawCall'],
    example: `curl '/api/indexer/move-calls/3iL1saWuDmg7tq4YaEVKXt7r9tAMHm36f5v4Lt7eBDqf/271'`,
  },
  {
    id: 'indexer-module-call-counts',
    group: 'indexer',
    method: 'GET',
    path: '/api/indexer/module-call-counts',
    title: 'Get Live Module Call Counts',
    auth: 'public',
    summary: 'Returns aggregated module-level call counts for the live overview module board.',
    notes: ['Used by the 5-second refresh module summary UI.'],
    response: ['modules[]'],
    example: `curl '/api/indexer/module-call-counts'`,
  },
  {
    id: 'world-route',
    group: 'world',
    method: 'GET',
    path: '/api/world/route',
    title: 'Find Route Between Systems',
    auth: 'public',
    summary: 'Computes a route between two solar system ids on the server.',
    params: ['originId', 'destinationId'],
    notes: ['Both ids must be numeric query params.'],
    response: ['route'],
    example: `curl '/api/world/route?originId=30000142&destinationId=30002510'`,
  },
  {
    id: 'world-system-search',
    group: 'world',
    method: 'GET',
    path: '/api/world/systems/search',
    title: 'Search Solar Systems',
    auth: 'public',
    summary: 'Performs server-side system search for atlas inputs and route pickers.',
    params: ['q'],
    notes: ['Returns lightweight search results under `data`.'],
    response: ['data[]'],
    example: `curl '/api/world/systems/search?q=jita'`,
  },
  {
    id: 'world-system-detail',
    group: 'world',
    method: 'GET',
    path: '/api/world/systems/{id}',
    title: 'Get Solar System Detail',
    auth: 'public',
    summary: 'Returns the detailed solar system payload for a numeric system id.',
    params: ['path.id'],
    notes: ['Returns `400` when the id is not numeric.'],
    response: ['system payload'],
    example: `curl '/api/world/systems/30000142'`,
  },
  {
    id: 'world-modules-summary',
    group: 'world',
    method: 'GET',
    path: '/api/world/modules-summary',
    title: 'Get Module Summary Board',
    auth: 'public',
    summary: 'Returns the aggregated module status board used by the home dashboard.',
    notes: ['This endpoint is cached with `revalidate = 60`.'],
    response: ['modules[]'],
    example: `curl '/api/world/modules-summary'`,
  },
  {
    id: 'users-get',
    group: 'users',
    method: 'GET',
    path: '/api/users',
    title: 'Find Wallet User',
    auth: 'public',
    summary: 'Looks up a wallet user record by Sui wallet address.',
    params: ['walletAddress'],
    notes: ['Returns `{ user: null }` if no user exists.'],
    response: ['user'],
    example: `curl '/api/users?walletAddress=0xabc...'`,
  },
  {
    id: 'users-post',
    group: 'users',
    method: 'POST',
    path: '/api/users',
    title: 'Upsert Wallet User',
    auth: 'public',
    summary: 'Creates or updates the wallet user record used by auth and profile-linked flows.',
    params: ['body.walletAddress', 'body.walletName?', 'body.chain?'],
    notes: ['Rejects invalid wallet addresses with `400`.'],
    response: ['user'],
    example: `curl '/api/users' \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -d '{"walletAddress":"0xabc...","walletName":"Sui Wallet","chain":"sui:testnet"}'`,
  },
]

function getMethodClassName(method: ApiDoc['method']) {
  if (method === 'GET') {
    return 'border-sky-300/80 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/35 dark:text-sky-100'
  }

  if (method === 'POST') {
    return 'border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100'
  }

  return 'border-rose-300/80 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-100'
}

function getAuthLabel(auth: ApiDoc['auth']) {
  switch (auth) {
    case 'jwt':
      return 'JWT only'
    case 'jwt-or-api-key':
      return 'JWT / API key'
    case 'optional':
      return 'Optional auth'
    default:
      return 'Public'
  }
}

export default function ApiDocsExplorer() {
  const [activeGroup, setActiveGroup] = useState<ApiDoc['group']>('indexer')
  const initialDoc = useMemo(
    () => API_DOCS.find((doc) => doc.group === 'indexer')?.id ?? API_DOCS[0].id,
    []
  )
  const [activeDocId, setActiveDocId] = useState(initialDoc)

  const groupDocs = API_DOCS.filter((doc) => doc.group === activeGroup)
  const activeDoc =
    groupDocs.find((doc) => doc.id === activeDocId) ??
    groupDocs[0] ??
    API_DOCS[0]

  return (
    <article className="rounded-[2rem] border border-slate-200/70 bg-white/92 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.08)] dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(3,8,18,0.98),rgba(8,16,30,0.95))]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
            <Braces className="h-4 w-4" />
            API Explorer
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
            All API endpoints in one place
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            Browse the project’s current API surface by group, then switch between child tabs to inspect each endpoint’s path, auth mode, filters, and copy-ready examples.
          </p>
        </div>
        <div className="rounded-full border border-slate-200/80 bg-slate-50/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
          {API_DOCS.length} endpoints
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[1.6rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.97),rgba(241,245,249,0.92))] p-3 shadow-[0_16px_34px_rgba(15,23,42,0.05)] dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(3,8,18,0.97),rgba(8,16,30,0.94))]">
          <div className="space-y-2">
            {API_GROUPS.map((group) => {
              const Icon = group.icon
              const isActive = activeGroup === group.id

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setActiveGroup(group.id)
                    const nextDoc = API_DOCS.find((doc) => doc.group === group.id)
                    if (nextDoc) {
                      setActiveDocId(nextDoc.id)
                    }
                  }}
                  className={`w-full rounded-[1.2rem] border px-4 py-3 text-left transition ${isActive
                    ? 'border-sky-300/80 bg-sky-50/90 shadow-[0_12px_28px_rgba(14,165,233,0.12)] dark:border-sky-900/80 dark:bg-sky-950/35'
                    : 'border-transparent bg-white/60 hover:border-slate-200/80 hover:bg-white/90 dark:bg-slate-950/30 dark:hover:border-slate-800 dark:hover:bg-slate-950/60'
                    }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                    <Icon className="h-4 w-4" />
                    {group.label}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {group.description}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 rounded-[1.3rem] border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800/90 dark:bg-slate-950/40">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              {API_GROUPS.find((group) => group.id === activeGroup)?.label} endpoints
            </div>
            <div className="mt-3 space-y-2">
              {groupDocs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setActiveDocId(doc.id)}
                  className={`w-full rounded-[1rem] border px-3 py-2 text-left transition ${activeDoc?.id === doc.id
                    ? 'border-slate-900 bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] dark:border-sky-300 dark:bg-sky-50 dark:text-slate-950'
                    : 'border-slate-200/80 bg-white/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-950'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${getMethodClassName(doc.method)}`}
                    >
                      {doc.method}
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold">{doc.title}</span>
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] opacity-80">{doc.path}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="rounded-[1.75rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)] dark:border-slate-800/90 dark:bg-[linear-gradient(180deg,rgba(6,12,22,0.97),rgba(10,18,34,0.94))]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${getMethodClassName(activeDoc.method)}`}
                >
                  {activeDoc.method}
                </span>
                <span className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200">
                  {getAuthLabel(activeDoc.auth)}
                </span>
              </div>
              <h4 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                {activeDoc.title}
              </h4>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                {activeDoc.summary}
              </p>
            </div>
            <a
              href={`#${activeDoc.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
            >
              <Link2 className="h-3.5 w-3.5" />
              Deep Link
            </a>
          </div>

          <div id={activeDoc.id} className="mt-5 space-y-5">
            <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Endpoint
              </div>
              <div className="mt-2 break-all rounded-[1rem] border border-slate-200/80 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-100 dark:border-slate-800">
                {activeDoc.path}
              </div>
            </div>

            {activeDoc.params && activeDoc.params.length > 0 ? (
              <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Parameters
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeDoc.params.map((param) => (
                    <span
                      key={param}
                      className="rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200"
                    >
                      {param}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Response shape
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeDoc.response.map((field) => (
                    <span
                      key={field}
                      className="rounded-full border border-sky-200/80 bg-sky-50/90 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-sky-800 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-200"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Notes
                </div>
                <div className="mt-3 space-y-2">
                  {activeDoc.notes.map((note) => (
                    <div
                      key={note}
                      className="rounded-[1rem] border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950/55 dark:text-slate-200"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-slate-200/80 bg-white/85 p-4 dark:border-slate-800 dark:bg-slate-950/55">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Example
              </div>
              <pre className="mt-3 overflow-x-auto rounded-[1.2rem] border border-slate-200/80 bg-slate-950 px-4 py-3 text-xs leading-6 text-slate-100 dark:border-slate-800">
                {activeDoc.example}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </article>
  )
}
