import { getSqlClient } from '~~/server/db/client.mjs'
import { requireAuthenticatedRequest } from '~~/server/auth/request.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedRequest(getSqlClient(), request)

    return json({
      auth: {
        type: auth.type,
        userId: auth.userId,
      },
      user: 'user' in auth ? auth.user : null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch current user'

    return json({ error: message }, { status: 401 })
  }
}
