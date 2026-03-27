import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getModuleCallCounts,
  listBuildingLeaderboard,
} from '../src/app/server/indexer/repository.mjs'

test('getModuleCallCounts returns empty counts when table is missing', async () => {
  const sql = async () => {
    const error = new Error('relation "suiscan_move_calls" does not exist')
    error.code = '42P01'
    throw error
  }

  const modules = await getModuleCallCounts(sql)

  assert.equal(modules.length, 20)
  assert.ok(modules.every((module) => module.callCount === 0))
  assert.ok(modules.every((module) => module.latestTransactionTime === null))
})

test('getModuleCallCounts returns empty counts when the database connection resets', async () => {
  const sql = async () => {
    const error = new Error('read ECONNRESET')
    error.code = 'ECONNRESET'
    throw error
  }

  const modules = await getModuleCallCounts(sql)

  assert.equal(modules.length, 20)
  assert.ok(modules.every((module) => module.callCount === 0))
  assert.ok(modules.every((module) => module.latestTransactionTime === null))
})

test('listBuildingLeaderboard maps grouped owner rows and includes the module filter', async () => {
  const calls = []
  const sql = async (strings, ...values) => {
    calls.push({
      text: strings.join(' '),
      values,
    })

    return [
      {
        tenant: 'utopia',
        owner_character_item_id: '1000000019867',
        wallet_address:
          '0x194d8faf60f2fd1551abae29f1f056ad43a386d305a11a904acbd35ef7f72b67',
        building_count: 4,
        last_seen_at: '2026-03-25T10:15:00.000Z',
      },
    ]
  }

  const leaderboard = await listBuildingLeaderboard(sql, {
    limit: 25,
    moduleName: 'gate',
  })

  assert.deepEqual(leaderboard, [
    {
      rank: 1,
      tenant: 'utopia',
      ownerCharacterItemId: '1000000019867',
      walletAddress:
        '0x194d8faf60f2fd1551abae29f1f056ad43a386d305a11a904acbd35ef7f72b67',
      buildingCount: 4,
      lastSeenAt: '2026-03-25T10:15:00.000Z',
    },
  ])

  assert.equal(calls.length, 1)
  assert.match(calls[0].text, /WITH grouped AS/)
  assert.match(calls[0].text, /bi\.module_name =/)
  assert.equal(calls[0].values[0], 'gate')
  assert.equal(calls[0].values[1], 25)
})
