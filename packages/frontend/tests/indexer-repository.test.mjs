import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getModuleCallCounts,
  getKillmailSummary,
  listBuildingLeaderboard,
  listKillmailRecords,
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

test('getKillmailSummary returns empty counts when table is missing', async () => {
  const sql = async () => {
    const error = new Error('relation "killmail_records" does not exist')
    error.code = '42P01'
    throw error
  }

  const summary = await getKillmailSummary(sql)

  assert.deepEqual(summary, {
    totalRecords: 0,
    resolvedTotal: 0,
    pendingTotal: 0,
    latestKillAt: null,
  })
})

test('listKillmailRecords maps killmail rows and applies the status filter', async () => {
  const calls = []
  const sql = async (strings, ...values) => {
    calls.push({
      text: strings.join(' '),
      values,
    })

    return [
      {
        tenant: 'utopia',
        killmail_item_id: '9000000001',
        tx_digest: '8R8Y2mExampleDigest',
        event_seq: '0',
        tx_checkpoint: '802110',
        tx_timestamp: '2026-03-27T15:37:00.000Z',
        kill_timestamp: '2026-03-27T15:37:00.000Z',
        kill_timestamp_unix: '1774625820',
        loss_type: 'frigate',
        solar_system_id: '31000142',
        killer_character_item_id: '2112000108',
        victim_character_item_id: '2112000113',
        reported_by_character_item_id: '2112000108',
        killer_wallet_address:
          '0x6cd391f1b61aea06e092e45229b292ed1846edc3ddd5e2928830ce4624c211c1',
        victim_wallet_address:
          '0xff0932fca8fa5ce33289f347278b2fc1201fbfa0f91aac76912a7f5e161b0f47',
        reported_by_wallet_address:
          '0x6cd391f1b61aea06e092e45229b292ed1846edc3ddd5e2928830ce4624c211c1',
        resolution_status: 'resolved',
        resolution_error: null,
        resolved_at: '2026-03-27T15:38:00.000Z',
        raw_event: { id: 'event-1' },
      },
    ]
  }

  const rows = await listKillmailRecords(sql, {
    status: 'resolved',
    limit: 20,
  })

  assert.deepEqual(rows, [
    {
      tenant: 'utopia',
      killmailItemId: '9000000001',
      txDigest: '8R8Y2mExampleDigest',
      eventSeq: '0',
      txCheckpoint: '802110',
      txTimestamp: '2026-03-27T15:37:00.000Z',
      killTimestamp: '2026-03-27T15:37:00.000Z',
      killTimestampUnix: '1774625820',
      lossType: 'frigate',
      solarSystemId: '31000142',
      killerCharacterItemId: '2112000108',
      victimCharacterItemId: '2112000113',
      reportedByCharacterItemId: '2112000108',
      killerWalletAddress:
        '0x6cd391f1b61aea06e092e45229b292ed1846edc3ddd5e2928830ce4624c211c1',
      victimWalletAddress:
        '0xff0932fca8fa5ce33289f347278b2fc1201fbfa0f91aac76912a7f5e161b0f47',
      reportedByWalletAddress:
        '0x6cd391f1b61aea06e092e45229b292ed1846edc3ddd5e2928830ce4624c211c1',
      resolutionStatus: 'resolved',
      resolutionError: null,
      resolvedAt: '2026-03-27T15:38:00.000Z',
      rawEvent: { id: 'event-1' },
    },
  ])

  assert.equal(calls.length, 1)
  assert.match(calls[0].text, /FROM killmail_records/)
  assert.match(calls[0].text, /WHERE resolution_status =/)
  assert.equal(calls[0].values[0], 'resolved')
  assert.equal(calls[0].values[1], 20)
})
