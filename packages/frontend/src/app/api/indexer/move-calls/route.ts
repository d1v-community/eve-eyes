import { resolveRequestAuth } from '~~/server/auth/request.mjs'
import { getFreePageLimit } from '~~/server/auth/config.mjs'
import { getSqlClient } from '~~/server/db/client.mjs'
import {
  listMoveCalls,
  parseMoveCallFilters,
} from '~~/server/indexer/listing-repository.mjs'
import { parsePagination, requirePageAccess } from '~~/server/pagination.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

export async function GET(request: Request) {
  try {
    const sql = getSqlClient()
    const url = new URL(request.url)
    const pagination = parsePagination(url.searchParams)
    const auth = await resolveRequestAuth(sql, request)

    requirePageAccess(pagination, auth)

    const result = await listMoveCalls(sql, {
      filters: parseMoveCallFilters(url.searchParams),
      pageSize: pagination.pageSize,
      offset: pagination.offset,
    })

    return json({
      items: result.items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / pagination.pageSize)),
        freePageLimit: pagination.freePageLimit,
      },
      auth: {
        type: auth.type,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to list move calls'
    let status = 500

    if (
      error instanceof Error &&
      [
        'page must be a positive integer',
        'pageSize must be a positive integer',
        'walletAddress must be a valid Sui address',
      ].includes(error.message)
    ) {
      status = 400
    } else if (
      error instanceof Error &&
      [
        'authentication is required for this page',
        'API key is invalid',
        'JWT user was not found',
        'token has expired',
        'token signature is invalid',
      ].includes(error.message)
    ) {
      status = 401
    } else if (
      error instanceof Error &&
      error.message === 'API key rate limit exceeded'
    ) {
      status = 429
    }

    return json(
      {
        error: message,
        freePageLimit: getFreePageLimit(),
      },
      { status }
    )
  }
}
