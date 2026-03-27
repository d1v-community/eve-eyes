import {
  createBuildingLeaderboardOptionsResponse,
  handleBuildingLeaderboardRequest,
} from '~~/server/indexer/building-leaderboard-api.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  return handleBuildingLeaderboardRequest(request)
}

export async function OPTIONS() {
  return createBuildingLeaderboardOptionsResponse()
}
