import { requireJwtRequest } from '~~/server/auth/request.mjs'
import {
  createUserApiKey,
  listUserApiKeys,
} from '~~/server/auth/repository.mjs'
import { getSqlClient } from '~~/server/db/client.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

export async function GET(request: Request) {
  try {
    const sql = getSqlClient()
    const auth = await requireJwtRequest(sql, request)
    const apiKeys = await listUserApiKeys(sql, auth.userId)

    return json({ apiKeys })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to list API keys'
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

export async function POST(request: Request) {
  try {
    const sql = getSqlClient()
    const auth = await requireJwtRequest(sql, request)
    const payload = await request.json()
    const result = await createUserApiKey(sql, auth.userId, payload)

    return json(
      {
        apiKey: result.apiKey,
        record: result.record,
      },
      { status: 201 }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create API key'
    let status = 500

    if (
      error instanceof Error &&
      [
        'authentication is required',
        'JWT authentication is required',
        'JWT user was not found',
      ].includes(error.message)
    ) {
      status = 401
    } else if (
      error instanceof Error &&
      ['name is required', 'name must be 80 characters or fewer'].includes(
        error.message
      )
    ) {
      status = 400
    } else if (
      error instanceof Error &&
      error.message === 'maximum active API keys reached'
    ) {
      status = 409
    }

    return json({ error: message }, { status })
  }
}
