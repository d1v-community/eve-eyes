import { Database, Globe2, KeyRound, UserRound } from 'lucide-react'

export type ApiDoc = {
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

export type ApiGroup = {
  id: ApiDoc['group']
  label: string
  icon: typeof KeyRound
  description: string
}

export const API_GROUPS: ApiGroup[] = [
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
    description:
      'Indexed chain records, block drill-down, and move call inspection.',
  },
  {
    id: 'world',
    label: 'World',
    icon: Globe2,
    description:
      'Route planning and world lookup endpoints used by atlas-style screens.',
  },
  {
    id: 'users',
    label: 'Users',
    icon: UserRound,
    description: 'Wallet user lookup and upsert helpers.',
  },
]

export const API_DOCS: ApiDoc[] = [
  {
    id: 'auth-challenge',
    group: 'auth',
    method: 'POST',
    path: '/api/auth/challenge',
    title: 'Create Wallet Login Challenge',
    auth: 'public',
    summary:
      'Creates a nonce-backed personal-sign message for a Sui wallet login flow.',
    params: ['body.walletAddress'],
    notes: [
      'Use this before `/api/auth/login`.',
      'The response includes `challenge.id`, `message`, `nonce`, and `expiresAt`.',
    ],
    response: [
      'challenge.id',
      'challenge.walletAddress',
      'challenge.message',
      'challenge.expiresAt',
    ],
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
    summary:
      'Verifies the signed challenge, returns a JWT, and sets the auth cookie.',
    params: [
      'body.challengeId',
      'body.walletAddress',
      'body.signature',
      'body.walletName?',
      'body.publicKey?',
    ],
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
    summary:
      'Returns the authenticated user and auth mode for the current browser or bearer session.',
    notes: [
      'Requires a valid JWT cookie or `Authorization: Bearer <jwt>` header.',
    ],
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
    summary:
      'Lists the current user’s API keys, including prefix, limits, usage, and revoke state.',
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
    notes: [
      'The plaintext API key is shown only in the creation response.',
      'Maximum active API keys are enforced server-side.',
    ],
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
    summary:
      'Revokes a key immediately so it can no longer authenticate protected endpoints.',
    params: ['path.id'],
    notes: [
      'Returns `404` if the key does not belong to the current user or no longer exists.',
    ],
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
    summary:
      'Pages through indexed transaction blocks with exact-match filters.',
    params: [
      'page',
      'pageSize',
      'network',
      'senderAddress',
      'status',
      'digest',
      'transactionKind',
      'checkpoint',
    ],
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
    summary:
      'Returns the full indexed transaction payload, including raw content, effects, and events.',
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
    summary:
      'Loads all move calls under a single transaction and can optionally parse action summaries in batch.',
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
    summary:
      'Pages through indexed move call rows and supports exact-match filters across digest, package, module, function, and call index.',
    params: [
      'page',
      'pageSize',
      'network',
      'senderAddress',
      'status',
      'txDigest',
      'packageId',
      'moduleName',
      'functionName',
      'callIndex',
      'includeActionSummary?',
    ],
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
    summary:
      'Returns a single move call with parsed action text, parsed entities, and raw call payload.',
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
    summary:
      'Returns aggregated module-level call counts for the live overview module board.',
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
    summary:
      'Performs server-side system search for atlas inputs and route pickers.',
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
    summary:
      'Returns the detailed solar system payload for a numeric system id.',
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
    summary:
      'Returns the aggregated module status board used by the home dashboard.',
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
    summary:
      'Creates or updates the wallet user record used by auth and profile-linked flows.',
    params: ['body.walletAddress', 'body.walletName?', 'body.chain?'],
    notes: ['Rejects invalid wallet addresses with `400`.'],
    response: ['user'],
    example: `curl '/api/users' \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -d '{"walletAddress":"0xabc...","walletName":"Sui Wallet","chain":"sui:testnet"}'`,
  },
]

export function getAuthLabel(auth: ApiDoc['auth']) {
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

export function getAgentAccessibleDocs() {
  return API_DOCS.filter((doc) => doc.auth !== 'jwt')
}

function replaceExampleOrigin(example: string, origin: string) {
  return example.replace(
    /curl '\/([^']*)'/g,
    (_match, path) => `curl '${origin}/${path}'`
  )
}

function replaceApiKeyPlaceholder(example: string, apiKey: string) {
  return example.replace(/<api-key>/g, apiKey)
}

export function buildAgentDocTemplate(input: {
  origin: string
  apiKey?: string | null
}) {
  const docs = getAgentAccessibleDocs()
  const origin = input.origin.replace(/\/$/, '')
  const apiKey = input.apiKey?.trim() || '<api-key-will-be-created-on-copy>'
  const sections = API_GROUPS.flatMap((group) => {
    const docsInGroup = docs.filter((doc) => doc.group === group.id)

    if (docsInGroup.length === 0) {
      return []
    }

    return [
      `## ${group.label}`,
      ...docsInGroup.map((doc) => {
        const lines = [
          `### ${doc.method} ${doc.path}`,
          `Title: ${doc.title}`,
          `Auth: ${getAuthLabel(doc.auth)}`,
          `Summary: ${doc.summary}`,
        ]

        if (doc.params?.length) {
          lines.push(`Params: ${doc.params.join(', ')}`)
        }

        lines.push(`Response: ${doc.response.join(', ')}`)

        if (doc.notes.length) {
          lines.push('Notes:')
          lines.push(...doc.notes.map((note) => `- ${note}`))
        }

        const example = replaceApiKeyPlaceholder(
          replaceExampleOrigin(doc.example, origin),
          apiKey
        )
        lines.push('Example:')
        lines.push('```bash')
        lines.push(example)
        lines.push('```')

        return lines.join('\n')
      }),
    ]
  })

  return [
    '# Eve Eyes Agent Access Document',
    '',
    'This document is optimized for agents and automation clients. It includes every endpoint available to an API key, plus public endpoints that can be called without authentication.',
    '',
    `Base URL: ${origin}`,
    `Host: ${origin.replace(/^https?:\/\//, '')}`,
    'Chain: sui',
    '',
    '## Authentication',
    `Primary header: Authorization: ApiKey ${apiKey}`,
    `Alternative header: x-api-key: ${apiKey}`,
    '',
    '## Usage Rules',
    '- Use the base URL exactly as shown above.',
    '- Prefer the Authorization header for machine clients.',
    '- JWT-only auth endpoints for session inspection and API key management are intentionally omitted.',
    '',
    ...sections,
  ].join('\n')
}
