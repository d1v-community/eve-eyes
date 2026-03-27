import test from 'node:test'
import assert from 'node:assert/strict'
import { resetCharacterCreationsCache } from '../src/app/server/indexer/character-directory.mjs'
import {
  getModuleCallCounts,
  getKillmailSummary,
  listBuildingLeaderboard,
  listKillmailRecords,
  listKillmailRecordsWithUsernames,
} from '../src/app/server/indexer/repository.mjs'

test('getModuleCallCounts returns empty counts when table is missing', async () => {
  const sql = async () => {
    const error = new Error('relation "suiscan_move_calls" does not exist')
    error.code = '42P01'
    throw error
  }

  const modules = await getModuleCallCounts(sql)

  assert.deepEqual(modules, [])
})

test('getModuleCallCounts returns empty counts when the database connection resets', async () => {
  const sql = async () => {
    const error = new Error('read ECONNRESET')
    error.code = 'ECONNRESET'
    throw error
  }

  const modules = await getModuleCallCounts(sql)

  assert.deepEqual(modules, [])
})

test('getModuleCallCounts filters zero-count modules and includes spotlight functions', async () => {
  const sql = async (strings) => {
    const text = strings.join(' ')

    if (text.includes('GROUP BY module_name, function_name')) {
      return [
        {
          module_name: 'character',
          function_name: 'borrow_owner_cap',
          call_count: 5577,
        },
        {
          module_name: 'character',
          function_name: 'create_character',
          call_count: 386,
        },
        {
          module_name: 'network_node',
          function_name: 'share_network_node',
          call_count: 420,
        },
      ]
    }

    return [
      {
        module_name: 'network_node',
        call_count: 1000,
        latest_transaction_time: '2026-03-28T02:30:00.000Z',
      },
      {
        module_name: 'character',
        call_count: 500,
        latest_transaction_time: '2026-03-28T02:27:00.000Z',
      },
    ]
  }

  const modules = await getModuleCallCounts(sql)

  assert.deepEqual(modules, [
    {
      moduleName: 'network_node',
      callCount: 1000,
      latestTransactionTime: '2026-03-28T02:30:00.000Z',
      spotlightFunctionName: 'share_network_node',
      spotlightFunctionCount: 420,
    },
    {
      moduleName: 'character',
      callCount: 500,
      latestTransactionTime: '2026-03-28T02:27:00.000Z',
      spotlightFunctionName: 'create_character',
      spotlightFunctionCount: 386,
    },
  ])
})

test('listBuildingLeaderboard maps grouped owner rows and includes the module filter', async () => {
  resetCharacterCreationsCache()
  const calls = []
  const sql = async (strings, ...values) => {
    const text = strings.join(' ')
    calls.push({
      text,
      values,
    })

    if (text.includes('FROM building_instances AS bi')) {
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

    if (text.includes('FROM suiscan_move_calls AS smc')) {
      return [
        {
          id: 1,
          tx_digest: 'tx-leaderboard',
          call_index: 0,
          raw_call: {
            arguments: [
              { Input: 1 },
              { Input: 0 },
              { Input: 2 },
              { Input: 3 },
              { Input: 4 },
              { Input: 5 },
              { Input: 6 },
            ],
          },
          transaction_time: '2026-03-25T10:00:00.000Z',
          raw_content: {
            transaction: {
              data: {
                transaction: {
                  kind: 'ProgrammableTransaction',
                  inputs: [
                    { type: 'object', objectId: '0xadmin' },
                    { type: 'object', objectId: '0xregistry' },
                    { type: 'pure', value: 1000000019867, valueType: 'u32' },
                    { type: 'pure', value: 'utopia', valueType: '0x1::string::String' },
                    { type: 'pure', value: 1000167, valueType: 'u32' },
                    {
                      type: 'pure',
                      value:
                        '0x194d8faf60f2fd1551abae29f1f056ad43a386d305a11a904acbd35ef7f72b67',
                      valueType: 'address',
                    },
                    { type: 'pure', value: 'leader-name', valueType: '0x1::string::String' },
                  ],
                },
              },
            },
          },
        },
      ]
    }

    throw new Error(`Unexpected query: ${text}`)
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
      userId: '1000000019867',
      walletAddress:
        '0x194d8faf60f2fd1551abae29f1f056ad43a386d305a11a904acbd35ef7f72b67',
      username: 'leader-name',
      buildingCount: 4,
      lastSeenAt: '2026-03-25T10:15:00.000Z',
    },
  ])

  assert.equal(calls.length, 2)
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

test('listKillmailRecordsWithUsernames enriches parties with usernames', async () => {
  resetCharacterCreationsCache()
  let callCount = 0
  const sql = async (strings, ...values) => {
    callCount += 1
    const text = strings.join(' ')

    if (text.includes('FROM killmail_records')) {
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

    if (text.includes('FROM suiscan_move_calls AS smc')) {
      return [
        {
          id: 1,
          tx_digest: 'tx-1',
          call_index: 0,
          raw_call: {
            arguments: [
              { Input: 1 },
              { Input: 0 },
              { Input: 2 },
              { Input: 3 },
              { Input: 4 },
              { Input: 5 },
              { Input: 6 },
            ],
          },
          transaction_time: '2026-03-27T15:00:00.000Z',
          raw_content: {
            transaction: {
              data: {
                transaction: {
                  kind: 'ProgrammableTransaction',
                  inputs: [
                    { type: 'object', objectId: '0xadmin' },
                    { type: 'object', objectId: '0xregistry' },
                    { type: 'pure', value: 2112000108, valueType: 'u32' },
                    { type: 'pure', value: 'utopia', valueType: '0x1::string::String' },
                    { type: 'pure', value: 1000167, valueType: 'u32' },
                    {
                      type: 'pure',
                      value:
                        '0x6cd391f1b61aea06e092e45229b292ed1846edc3ddd5e2928830ce4624c211c1',
                      valueType: 'address',
                    },
                    { type: 'pure', value: 'killer-name', valueType: '0x1::string::String' },
                  ],
                },
              },
            },
          },
        },
        {
          id: 2,
          tx_digest: 'tx-2',
          call_index: 0,
          raw_call: {
            arguments: [
              { Input: 1 },
              { Input: 0 },
              { Input: 2 },
              { Input: 3 },
              { Input: 4 },
              { Input: 5 },
              { Input: 6 },
            ],
          },
          transaction_time: '2026-03-27T14:00:00.000Z',
          raw_content: {
            transaction: {
              data: {
                transaction: {
                  kind: 'ProgrammableTransaction',
                  inputs: [
                    { type: 'object', objectId: '0xadmin' },
                    { type: 'object', objectId: '0xregistry' },
                    { type: 'pure', value: 2112000113, valueType: 'u32' },
                    { type: 'pure', value: 'utopia', valueType: '0x1::string::String' },
                    { type: 'pure', value: 1000167, valueType: 'u32' },
                    {
                      type: 'pure',
                      value:
                        '0xff0932fca8fa5ce33289f347278b2fc1201fbfa0f91aac76912a7f5e161b0f47',
                      valueType: 'address',
                    },
                    { type: 'pure', value: 'victim-name', valueType: '0x1::string::String' },
                  ],
                },
              },
            },
          },
        },
      ]
    }

    throw new Error(`Unexpected query: ${text} :: ${values.join(',')}`)
  }

  const rows = await listKillmailRecordsWithUsernames(sql, {
    status: 'resolved',
    limit: 20,
  })

  assert.equal(rows[0].killerUsername, 'killer-name')
  assert.equal(rows[0].victimUsername, 'victim-name')
  assert.equal(rows[0].reportedByUsername, 'killer-name')
})
