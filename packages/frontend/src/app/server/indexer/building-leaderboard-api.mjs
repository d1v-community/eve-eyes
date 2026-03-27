import { resolveRequestAuth } from '../auth/request.mjs'
import { getSqlClient } from '../db/client.mjs'
import { listBuildingLeaderboard } from './repository.mjs'

export const BUILDING_LEADERBOARD_API_VERSION = 'v1'
export const BUILDING_LEADERBOARD_MODULES = [
  'assembly',
  'gate',
  'network_node',
  'storage_unit',
  'turret',
]

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const RATE_LIMIT_RETRY_AFTER_SECONDS = 1

function applyPublicApiHeaders(headers) {
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-API-Key'
  )
  headers.set('Access-Control-Max-Age', '600')
  headers.set('Access-Control-Expose-Headers', 'X-API-Version')
  headers.set('Cache-Control', 'no-store, max-age=0')
  headers.set('X-API-Version', BUILDING_LEADERBOARD_API_VERSION)
  headers.set('Vary', 'Authorization, X-API-Key, Origin')

  return headers
}

export function createBuildingLeaderboardHeaders(initHeaders) {
  return applyPublicApiHeaders(new Headers(initHeaders))
}

function json(data, init) {
  return Response.json(data, {
    ...init,
    headers: createBuildingLeaderboardHeaders(init?.headers),
  })
}

export function createBuildingLeaderboardOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: createBuildingLeaderboardHeaders(),
  })
}

export function parseBuildingLeaderboardLimit(value) {
  if (!value) {
    return DEFAULT_LIMIT
  }

  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error('limit must be a positive integer')
  }

  return Math.min(parsed, MAX_LIMIT)
}

export function parseBuildingLeaderboardModuleName(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  const normalized = value.trim().toLowerCase()

  if (!BUILDING_LEADERBOARD_MODULES.includes(normalized)) {
    throw new Error(
      `moduleName must be one of: ${BUILDING_LEADERBOARD_MODULES.join(', ')}`
    )
  }

  return normalized
}

export function parseBuildingLeaderboardQuery(searchParams) {
  return {
    limit: parseBuildingLeaderboardLimit(searchParams.get('limit')),
    moduleName: parseBuildingLeaderboardModuleName(searchParams.get('moduleName')),
  }
}

function getErrorResponseMeta(error) {
  if (!(error instanceof Error)) {
    return {
      status: 500,
      code: 'INTERNAL_ERROR',
      retryAfter: null,
      message: 'Failed to fetch building leaderboard',
    }
  }

  if (error.message === 'limit must be a positive integer') {
    return {
      status: 400,
      code: 'INVALID_LIMIT',
      retryAfter: null,
      message: error.message,
    }
  }

  if (error.message.startsWith('moduleName must be one of:')) {
    return {
      status: 400,
      code: 'INVALID_MODULE_NAME',
      retryAfter: null,
      message: error.message,
    }
  }

  if (error.message === 'API key rate limit exceeded') {
    return {
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: RATE_LIMIT_RETRY_AFTER_SECONDS,
      message: error.message,
    }
  }

  if (error.message === 'API key is invalid') {
    return {
      status: 401,
      code: 'INVALID_API_KEY',
      retryAfter: null,
      message: error.message,
    }
  }

  if (
    [
      'JWT user was not found',
      'token has expired',
      'token signature is invalid',
    ].includes(error.message)
  ) {
    return {
      status: 401,
      code: 'INVALID_AUTH_TOKEN',
      retryAfter: null,
      message: error.message,
    }
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    retryAfter: null,
    message: error.message,
  }
}

export async function handleBuildingLeaderboardRequest(
  request,
  input = {}
) {
  const deps = {
    getSqlClient,
    listBuildingLeaderboard,
    resolveRequestAuth,
    ...input,
  }

  try {
    const sql = deps.getSqlClient()
    const auth = await deps.resolveRequestAuth(sql, request)
    const { searchParams } = new URL(request.url)
    const leaderboard = await deps.listBuildingLeaderboard(
      sql,
      parseBuildingLeaderboardQuery(searchParams)
    )

    return json({
      ok: true,
      apiVersion: BUILDING_LEADERBOARD_API_VERSION,
      auth: {
        type: auth.type,
      },
      leaderboard,
    })
  } catch (error) {
    const meta = getErrorResponseMeta(error)
    const headers =
      meta.retryAfter == null
        ? undefined
        : {
            'Retry-After': String(meta.retryAfter),
          }

    return json(
      {
        ok: false,
        apiVersion: BUILDING_LEADERBOARD_API_VERSION,
        error: meta.message,
        errorCode: meta.code,
      },
      {
        status: meta.status,
        headers,
      }
    )
  }
}
