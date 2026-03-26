import { getSqlClient } from '~~/server/db/client.mjs'
import { listBuildingLeaderboard } from '~~/server/indexer/repository.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

function parseLimit(value: string | null) {
  if (!value) {
    return 50
  }

  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error('limit must be a positive integer')
  }

  return Math.min(parsed, 200)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leaderboard = await listBuildingLeaderboard(getSqlClient(), {
      limit: parseLimit(searchParams.get('limit')),
      moduleName: searchParams.get('moduleName'),
    })

    return json({ leaderboard })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch building leaderboard'

    return json({ error: message }, { status: 500 })
  }
}
