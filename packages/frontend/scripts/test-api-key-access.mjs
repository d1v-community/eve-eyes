import { spawnSync } from 'node:child_process'

const DEFAULT_TIMEOUT_SECONDS = 20
const PROTECTED_ENDPOINTS = [
  {
    name: 'transaction-blocks protected page',
    path: '/api/indexer/transaction-blocks?page=4&pageSize=5',
    expectedAuthType: 'apiKey',
  },
  {
    name: 'move-calls protected page',
    path: '/api/indexer/move-calls?page=4&pageSize=5',
    expectedAuthType: 'apiKey',
  },
  {
    name: 'character-creations protected page',
    path: '/api/indexer/character-creations?page=4&pageSize=5',
    expectedAuthType: 'apiKey',
  },
  {
    name: 'user-activities protected page',
    path: '/api/indexer/user-activities?page=4&pageSize=5',
    expectedAuthType: 'apiKey',
  },
  {
    name: 'building-leaderboard v1 optional api key',
    path: '/api/v1/indexer/building-leaderboard?limit=5',
    expectedAuthType: 'apiKey',
  },
  {
    name: 'building-leaderboard alias optional api key',
    path: '/api/indexer/building-leaderboard?limit=5',
    expectedAuthType: 'apiKey',
  },
]

function getArgValue(name, fallback = null) {
  const prefix = `${name}=`
  const entry = process.argv.slice(2).find((arg) => arg.startsWith(prefix))

  if (!entry) {
    return fallback
  }

  return entry.slice(prefix.length)
}

function normalizeBaseUrl(input) {
  if (!input) {
    throw new Error('BASE_URL is required')
  }

  return input.replace(/\/+$/, '')
}

function getCurlPath() {
  return process.env.CURL_BIN?.trim() || '/usr/bin/curl'
}

function parseTimeoutSeconds(value) {
  if (!value) {
    return DEFAULT_TIMEOUT_SECONDS
  }

  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error('TIMEOUT_SECONDS must be a positive integer')
  }

  return parsed
}

function buildCurlArgs({ url, apiKey, timeoutSeconds }) {
  return [
    '--http1.1',
    '-sS',
    '-m',
    String(timeoutSeconds),
    '-H',
    `Authorization: ApiKey ${apiKey}`,
    '-H',
    `x-api-key: ${apiKey}`,
    '-H',
    'Accept: application/json',
    '-H',
    'User-Agent: eve-eyes-api-key-check/1.0',
    '-w',
    '\n__META__:%{http_code}:%{time_total}',
    url,
  ]
}

function parseCurlOutput(output) {
  const marker = '\n__META__'
  const markerIndex = output.lastIndexOf(marker)

  if (markerIndex === -1) {
    return {
      bodyText: output.trim(),
      status: 0,
      totalSeconds: null,
    }
  }

  const bodyText = output.slice(0, markerIndex).trim()
  const meta = output.slice(markerIndex + marker.length + 1).trim()
  const [statusText, totalSecondsText] = meta.split(':')

  return {
    bodyText,
    status: Number.parseInt(statusText, 10) || 0,
    totalSeconds: totalSecondsText ? Number.parseFloat(totalSecondsText) : null,
  }
}

function parseBody(bodyText) {
  if (!bodyText) {
    return null
  }

  try {
    return JSON.parse(bodyText)
  } catch {
    return {
      raw: bodyText.slice(0, 300),
    }
  }
}

function buildResultSummary(endpoint, url, curlResult) {
  const parsed = parseCurlOutput(curlResult.stdout)
  const payload = parseBody(parsed.bodyText)
  const authType = payload?.auth?.type ?? null
  const expectedAuthType = endpoint.expectedAuthType
  const okStatus = parsed.status >= 200 && parsed.status < 300
  const matchesExpectedAuthType =
    expectedAuthType == null ? true : authType === expectedAuthType

  return {
    name: endpoint.name,
    url,
    status: parsed.status,
    ok: okStatus,
    authType,
    expectedAuthType,
    matchesExpectedAuthType,
    itemCount: Array.isArray(payload?.items)
      ? payload.items.length
      : Array.isArray(payload?.leaderboard)
        ? payload.leaderboard.length
        : null,
    error: typeof payload?.error === 'string' ? payload.error : null,
    errorCode: typeof payload?.errorCode === 'string' ? payload.errorCode : null,
    totalSeconds: parsed.totalSeconds,
    curlExitCode: curlResult.status ?? null,
    curlStderr: curlResult.stderr?.trim() || null,
  }
}

function runEndpointCheck({ baseUrl, apiKey, timeoutSeconds, endpoint }) {
  const url = `${baseUrl}${endpoint.path}`
  const curlResult = spawnSync(getCurlPath(), buildCurlArgs({ url, apiKey, timeoutSeconds }), {
    encoding: 'utf8',
    env: process.env,
  })

  return buildResultSummary(endpoint, url, curlResult)
}

function printSummary(results) {
  for (const result of results) {
    console.log(JSON.stringify(result))
  }

  const passed = results.filter((result) => result.ok && result.matchesExpectedAuthType)
  const failed = results.filter((result) => !(result.ok && result.matchesExpectedAuthType))

  console.log(
    JSON.stringify({
      total: results.length,
      passed: passed.length,
      failed: failed.length,
    })
  )

  if (failed.length > 0) {
    process.exitCode = 1
  }
}

const baseUrl = normalizeBaseUrl(
  getArgValue('base') ?? process.env.BASE_URL ?? null
)
const apiKey = getArgValue('apiKey') ?? process.env.API_KEY ?? null
const timeoutSeconds = parseTimeoutSeconds(
  getArgValue('timeout') ?? process.env.TIMEOUT_SECONDS ?? null
)

if (!apiKey) {
  throw new Error('API_KEY is required')
}

const results = PROTECTED_ENDPOINTS.map((endpoint) =>
  runEndpointCheck({
    baseUrl,
    apiKey,
    timeoutSeconds,
    endpoint,
  })
)

printSummary(results)
