import { getSqlClient } from '~~/server/db/client.mjs'
import { getModuleCallCounts } from '~~/server/indexer/repository.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

export async function GET() {
  try {
    const modules = await getModuleCallCounts(getSqlClient())

    return json({ modules })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch module call counts'

    return json({ error: message }, { status: 500 })
  }
}
