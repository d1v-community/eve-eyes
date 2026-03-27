import { resolveRequestAuth } from '~~/server/auth/request.mjs'
import { getSqlClient } from '~~/server/db/client.mjs'
import { searchCharacterUsers } from '~~/server/indexer/character-directory.mjs'

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
    const auth = await resolveRequestAuth(sql, request)

    if (auth.type === 'anonymous') {
      throw new Error('authentication is required for this endpoint')
    }

    const url = new URL(request.url)
    const q = url.searchParams.get('q')
    const walletAddress = url.searchParams.get('walletAddress')
    const username = url.searchParams.get('username')
    const userId = url.searchParams.get('userId')

    if (![q, walletAddress, username, userId].some((value) => value?.trim())) {
      return json(
        { error: 'Provide q, walletAddress, username, or userId' },
        { status: 400 }
      )
    }

    const result = await searchCharacterUsers(sql, {
      q: q ?? undefined,
      walletAddress: walletAddress ?? undefined,
      username: username ?? undefined,
      userId: userId ?? undefined,
    })

    return json({
      ...result,
      auth: {
        type: auth.type,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to search character users'
    let status = 500

    if (message === 'authentication is required for this endpoint') {
      status = 401
    } else if (message === 'API key is invalid') {
      status = 401
    } else if (message === 'API key rate limit exceeded') {
      status = 429
    }

    return json({ error: message }, { status })
  }
}
