import { getSqlClient } from '~~/server/db/client.mjs'
import { listPublicKillmailFeed } from '~~/server/indexer/repository.mjs'

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

function parseLimit(value: string | null) {
  if (value == null || value.trim().length === 0) {
    return 40
  }

  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error('limit must be a positive integer')
  }

  return Math.min(parsed, 100)
}

function parseStatus(value: string | null) {
  if (value == null || value.trim().length === 0) {
    return null
  }

  if (value === 'resolved' || value === 'pending') {
    return value
  }

  throw new Error('status must be one of: resolved, pending')
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const items = await listPublicKillmailFeed(getSqlClient(), {
      limit: parseLimit(url.searchParams.get('limit')),
      status: parseStatus(url.searchParams.get('status')),
    })

    return json({ items })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to list killmails'
    const status =
      error instanceof Error &&
      (
        error.message === 'limit must be a positive integer' ||
        error.message === 'status must be one of: resolved, pending'
      )
        ? 400
        : 500

    return json({ error: message }, { status })
  }
}
