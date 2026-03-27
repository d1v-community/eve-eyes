import { resolveRequestAuth } from '~~/server/auth/request.mjs'
import { getFreePageLimit } from '~~/server/auth/config.mjs'
import { getSqlClient } from '~~/server/db/client.mjs'
import { listCharacterCreations } from '~~/server/indexer/listing-repository.mjs'
import { parsePagination, requirePageAccess } from '~~/server/pagination.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Cache-Control', 'no-store, max-age=0')

  return Response.json(data, {
    ...init,
    headers,
  })
}

export async function GET(request: Request) {
  try {
    const sql = getSqlClient()
    const url = new URL(request.url)
    const pagination = parsePagination(url.searchParams)
    const auth = await resolveRequestAuth(sql, request)

    requirePageAccess(pagination, auth)

    const result = await listCharacterCreations(sql, {
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
      error instanceof Error ? error.message : 'Failed to list character creations'
    let status = 500

    if (
      error instanceof Error &&
      error.message.includes('must be a positive integer')
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
