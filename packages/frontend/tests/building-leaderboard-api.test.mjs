import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BUILDING_LEADERBOARD_API_VERSION,
  createBuildingLeaderboardOptionsResponse,
  handleBuildingLeaderboardRequest,
  parseBuildingLeaderboardQuery,
} from '../src/app/server/indexer/building-leaderboard-api.mjs'

test('parseBuildingLeaderboardQuery applies defaults and trims moduleName', () => {
  const searchParams = new URL(
    'https://example.com/api/v1/indexer/building-leaderboard?moduleName=%20Gate%20'
  ).searchParams

  assert.deepEqual(parseBuildingLeaderboardQuery(searchParams), {
    limit: 50,
    moduleName: 'gate',
  })
})

test('parseBuildingLeaderboardQuery rejects unsupported module names', () => {
  const searchParams = new URL(
    'https://example.com/api/v1/indexer/building-leaderboard?moduleName=world'
  ).searchParams

  assert.throws(
    () => parseBuildingLeaderboardQuery(searchParams),
    /moduleName must be one of:/
  )
})

test('handleBuildingLeaderboardRequest returns versioned public payload with CORS headers', async () => {
  const request = new Request(
    'https://example.com/api/v1/indexer/building-leaderboard?limit=2&moduleName=gate'
  )

  const response = await handleBuildingLeaderboardRequest(request, {
    getSqlClient() {
      return { tag: 'sql' }
    },
    async resolveRequestAuth(sql, currentRequest) {
      assert.deepEqual(sql, { tag: 'sql' })
      assert.equal(currentRequest.url, request.url)

      return {
        type: 'apiKey',
        userId: 'user-1',
      }
    },
    async listBuildingLeaderboard(sql, input) {
      assert.deepEqual(sql, { tag: 'sql' })
      assert.deepEqual(input, {
        limit: 2,
        moduleName: 'gate',
      })

      return [
        {
          rank: 1,
          tenant: 'utopia',
          ownerCharacterItemId: '2112000069',
          userId: '2112000069',
          walletAddress:
            '0xad0221857e57908707762a74b68e6f340b06a6e9f991c270ae9c06cf1a92fb71',
          username: 'leader-name',
          buildingCount: 54,
          lastSeenAt: '2026-03-26T12:48:36.498Z',
        },
      ]
    },
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), '*')
  assert.equal(response.headers.get('access-control-allow-methods'), 'GET, OPTIONS')
  assert.equal(response.headers.get('x-api-version'), BUILDING_LEADERBOARD_API_VERSION)

  const body = await response.json()

  assert.deepEqual(body, {
    ok: true,
    apiVersion: BUILDING_LEADERBOARD_API_VERSION,
    auth: {
      type: 'apiKey',
    },
    leaderboard: [
      {
        rank: 1,
        tenant: 'utopia',
        ownerCharacterItemId: '2112000069',
        userId: '2112000069',
        walletAddress:
          '0xad0221857e57908707762a74b68e6f340b06a6e9f991c270ae9c06cf1a92fb71',
        username: 'leader-name',
        buildingCount: 54,
        lastSeenAt: '2026-03-26T12:48:36.498Z',
      },
    ],
  })
})

test('handleBuildingLeaderboardRequest returns structured invalid-limit errors', async () => {
  const response = await handleBuildingLeaderboardRequest(
    new Request('https://example.com/api/v1/indexer/building-leaderboard?limit=0'),
    {
      getSqlClient() {
        return {}
      },
      async resolveRequestAuth() {
        return {
          type: 'anonymous',
          userId: null,
        }
      },
      async listBuildingLeaderboard() {
        throw new Error('listBuildingLeaderboard should not be called')
      },
    }
  )

  assert.equal(response.status, 400)

  const body = await response.json()

  assert.deepEqual(body, {
    ok: false,
    apiVersion: BUILDING_LEADERBOARD_API_VERSION,
    error: 'limit must be a positive integer',
    errorCode: 'INVALID_LIMIT',
  })
})

test('handleBuildingLeaderboardRequest maps API key throttling to 429', async () => {
  const response = await handleBuildingLeaderboardRequest(
    new Request('https://example.com/api/v1/indexer/building-leaderboard'),
    {
      getSqlClient() {
        return {}
      },
      async resolveRequestAuth() {
        throw new Error('API key rate limit exceeded')
      },
      async listBuildingLeaderboard() {
        throw new Error('listBuildingLeaderboard should not be called')
      },
    }
  )

  assert.equal(response.status, 429)
  assert.equal(response.headers.get('retry-after'), '1')

  const body = await response.json()

  assert.deepEqual(body, {
    ok: false,
    apiVersion: BUILDING_LEADERBOARD_API_VERSION,
    error: 'API key rate limit exceeded',
    errorCode: 'RATE_LIMIT_EXCEEDED',
  })
})

test('createBuildingLeaderboardOptionsResponse exposes public CORS headers', () => {
  const response = createBuildingLeaderboardOptionsResponse()

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), '*')
  assert.equal(response.headers.get('access-control-allow-methods'), 'GET, OPTIONS')
  assert.equal(response.headers.get('x-api-version'), BUILDING_LEADERBOARD_API_VERSION)
})
