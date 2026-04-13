import { getSqlClient } from '~~/server/db/client.mjs'
import { getCharacterUserProfile } from '~~/server/indexer/character-directory.mjs'

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
    const walletAddress = url.searchParams.get('walletAddress')
    const username = url.searchParams.get('username')
    const userId = url.searchParams.get('userId')
    const tenant = url.searchParams.get('tenant')

    if (![walletAddress, username, userId, tenant].some((value) => value?.trim())) {
      return json(
        { error: 'Provide walletAddress, username, userId, or tenant' },
        { status: 400 }
      )
    }

    const profile = await getCharacterUserProfile(sql, {
      walletAddress: walletAddress ?? undefined,
      username: username ?? undefined,
      userId: userId ?? undefined,
      tenant: tenant ?? undefined,
    })

    if (!profile) {
      return json({ error: 'Character user not found' }, { status: 404 })
    }

    return json({
      profile,
      auth: {
        type: 'anonymous',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load character user detail'
    let status = 500

    if (message === 'API key rate limit exceeded') {
      status = 429
    }

    return json({ error: message }, { status })
  }
}
