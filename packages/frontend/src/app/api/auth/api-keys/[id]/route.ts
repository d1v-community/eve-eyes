import { requireJwtRequest } from '~~/server/auth/request.mjs'
import { revokeUserApiKey } from '~~/server/auth/repository.mjs'
import { getSqlClient } from '~~/server/db/client.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const apiKeyId = Number.parseInt(id, 10)

    if (Number.isNaN(apiKeyId) || apiKeyId <= 0) {
      return json({ error: 'id must be a positive integer' }, { status: 400 })
    }

    const sql = getSqlClient()
    const auth = await requireJwtRequest(sql, request)
    const record = await revokeUserApiKey(sql, auth.userId, apiKeyId)

    if (!record) {
      return json({ error: 'API key was not found' }, { status: 404 })
    }

    return json({ record })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to revoke API key'
    const status =
      error instanceof Error &&
      ['authentication is required', 'JWT authentication is required'].includes(
        error.message
      )
        ? 401
        : 500

    return json({ error: message }, { status })
  }
}
