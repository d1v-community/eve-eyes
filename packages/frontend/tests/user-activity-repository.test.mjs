import test from 'node:test'
import assert from 'node:assert/strict'
import {
  listUserActivities,
  parseUserActivityFilters,
} from '../src/app/server/indexer/user-activity-repository.mjs'

test('parseUserActivityFilters normalizes supported query params', () => {
  const filters = parseUserActivityFilters(
    new URLSearchParams({
      address: ' 0xabc ',
      walletAddress: ' 0xabc ',
      objectId: ' 0xdef ',
      tenant: ' utopia ',
      activityType: ' jump ',
      moduleName: ' world ',
      functionName: ' jump ',
      sourceKind: ' event ',
      txDigest: ' tx-1 ',
      eventSeq: ' 3 ',
      callIndex: '0',
      from: '2026-03-25T00:00:00.000Z',
      to: '2026-03-26T00:00:00.000Z',
    })
  )

  assert.deepEqual(filters, {
    address: '0xabc',
    walletAddress: '0xabc',
    objectId: '0xdef',
    tenant: 'utopia',
    activityType: 'jump',
    moduleName: 'world',
    functionName: 'jump',
    sourceKind: 'event',
    txDigest: 'tx-1',
    eventSeq: '3',
    callIndex: 0,
    from: '2026-03-25T00:00:00.000Z',
    to: '2026-03-26T00:00:00.000Z',
  })
})

test('parseUserActivityFilters rejects invalid timestamps', () => {
  assert.throws(
    () => parseUserActivityFilters(new URLSearchParams({ from: 'not-a-date' })),
    /from must be a valid timestamp/
  )
})

test('listUserActivities enriches character_created summaries with username', async () => {
  const sql = Object.assign(
    async (strings) => {
      const text = strings.join(' ')

      if (text.includes('FROM suiscan_move_calls AS smc')) {
        return [
          {
            id: 1,
            tx_digest: 'tx-create',
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
            transaction_time: '2026-03-24T12:31:19.000Z',
            raw_content: {
              transaction: {
                data: {
                  transaction: {
                    kind: 'ProgrammableTransaction',
                    inputs: [
                      { type: 'object', objectId: '0xadmin' },
                      { type: 'object', objectId: '0xregistry' },
                      { type: 'pure', value: 2112000209, valueType: 'u32' },
                      { type: 'pure', value: 'utopia', valueType: '0x1::string::String' },
                      { type: 'pure', value: 1000167, valueType: 'u32' },
                      {
                        type: 'pure',
                        value:
                          '0xe514fd6a1e1bc29f15eae4a89f1e936d9fbc456e3618cf4139fbd3f04f7e5715',
                        valueType: 'address',
                      },
                      { type: 'pure', value: 'diven', valueType: '0x1::string::String' },
                    ],
                  },
                },
              },
            },
          },
        ]
      }

      throw new Error(`Unexpected tagged query: ${text}`)
    },
    {
      unsafe: async (text) => {
        if (text.includes('FROM user_activity_records AS record') && text.includes('COUNT(*)::int')) {
          return [{ total: 1 }]
        }

        if (text.includes('FROM user_activity_records AS record')) {
          return [
            {
              id: 10,
              tenant: 'utopia',
              tx_digest: 'BFPePPEabYXQV8',
              event_seq: '2',
              call_index: null,
              activity_time: '2026-03-24T12:31:19.000Z',
              activity_type: 'character_created',
              module_name: 'character',
              function_name: null,
              source_kind: 'event',
              summary:
                'Character 2112000209 was created for wallet 0xe514fd6a1e1bc29f15eae4a89f1e936d9fbc456e3618cf4139fbd3f04f7e5715.',
              primary_wallet_address:
                '0xe514fd6a1e1bc29f15eae4a89f1e936d9fbc456e3618cf4139fbd3f04f7e5715',
              primary_character_item_id: '2112000209',
              primary_character_object_id: '0xcharacter',
              raw_source: {},
              created_at: '2026-03-24T12:31:19.000Z',
              updated_at: '2026-03-24T12:31:19.000Z',
            },
          ]
        }

        if (text.includes('FROM user_activity_participants')) {
          return [
            {
              id: 20,
              activity_record_id: 10,
              role: 'actor',
              tenant: 'utopia',
              character_item_id: '2112000209',
              character_object_id: '0xcharacter',
              wallet_address:
                '0xe514fd6a1e1bc29f15eae4a89f1e936d9fbc456e3618cf4139fbd3f04f7e5715',
              resolved_via: 'event_wallet',
              created_at: '2026-03-24T12:31:19.000Z',
              updated_at: '2026-03-24T12:31:19.000Z',
            },
          ]
        }

        throw new Error(`Unexpected unsafe query: ${text}`)
      },
    }
  )

  const result = await listUserActivities(sql, {
    filters: parseUserActivityFilters(new URLSearchParams()),
    pageSize: 20,
    offset: 0,
  })

  assert.equal(result.items[0].username, 'diven')
  assert.equal(result.items[0].participants[0].username, 'diven')
  assert.equal(
    result.items[0].summary,
    'diven created character 2112000209 for wallet 0xe514fd6a1e1bc29f15eae4a89f1e936d9fbc456e3618cf4139fbd3f04f7e5715.'
  )
})
