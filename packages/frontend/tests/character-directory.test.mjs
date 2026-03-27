import test from 'node:test'
import assert from 'node:assert/strict'

import {
  enrichActionEntitiesWithUsernames,
  resolveCharacterLabels,
  searchCharacterUsers,
} from '../src/app/server/indexer/character-directory.mjs'

function createSqlStub(rows) {
  return async () => rows
}

test('searchCharacterUsers matches by wallet address, username, and user id', async () => {
  const rows = [
    {
      id: 1,
      tx_digest: 'tx-1',
      call_index: 7,
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
      transaction_time: '2026-03-28T02:27:00.000Z',
      raw_content: {
        transaction: {
          data: {
            transaction: {
              kind: 'ProgrammableTransaction',
              inputs: [
                { type: 'object', objectId: '0xadmin' },
                { type: 'object', objectId: '0xregistry' },
                { type: 'pure', value: 2112000164, valueType: 'u32' },
                { type: 'pure', value: 'utopia', valueType: '0x1::string::String' },
                { type: 'pure', value: 1000167, valueType: 'u32' },
                {
                  type: 'pure',
                  value:
                    '0x7a98a2a5c810258b5bb469f3a15888b8e4ea4faa79b0d558cc397d3de1b998fb',
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

  const sql = createSqlStub(rows)

  const byWallet = await searchCharacterUsers(sql, {
    walletAddress: '0x7A98A2A5C810258B5BB469F3A15888B8E4EA4FAA79B0D558CC397D3DE1B998FB',
  })
  const byUsername = await searchCharacterUsers(sql, { username: 'diven' })
  const byUserId = await searchCharacterUsers(sql, { userId: '2112000164' })

  assert.equal(byWallet.profiles.length, 1)
  assert.equal(byUsername.profiles.length, 1)
  assert.equal(byUserId.profiles.length, 1)
  assert.equal(byWallet.profiles[0].username, 'diven')
  assert.equal(
    byWallet.profiles[0].walletAddress,
    '0x7a98a2a5c810258b5bb469f3a15888b8e4ea4faa79b0d558cc397d3de1b998fb'
  )
  assert.equal(byWallet.profiles[0].userId, '2112000164')
})

test('resolveCharacterLabels and enrichActionEntitiesWithUsernames expose latest username by wallet', async () => {
  const rows = [
    {
      id: 2,
      tx_digest: 'tx-2',
      call_index: 8,
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
      transaction_time: '2026-03-28T03:27:00.000Z',
      raw_content: {
        transaction: {
          data: {
            transaction: {
              kind: 'ProgrammableTransaction',
              inputs: [
                { type: 'object', objectId: '0xadmin' },
                { type: 'object', objectId: '0xregistry' },
                { type: 'pure', value: 2112000164, valueType: 'u32' },
                { type: 'pure', value: 'utopia', valueType: '0x1::string::String' },
                { type: 'pure', value: 1000167, valueType: 'u32' },
                {
                  type: 'pure',
                  value:
                    '0x7a98a2a5c810258b5bb469f3a15888b8e4ea4faa79b0d558cc397d3de1b998fb',
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

  const sql = createSqlStub(rows)
  const labels = await resolveCharacterLabels(sql, {
    walletAddresses: ['0x7a98a2a5c810258b5bb469f3a15888b8e4ea4faa79b0d558cc397d3de1b998fb'],
    userIds: ['2112000164'],
  })

  assert.equal(
    labels.walletLabels.get(
      '0x7a98a2a5c810258b5bb469f3a15888b8e4ea4faa79b0d558cc397d3de1b998fb'
    ),
    'diven'
  )
  assert.equal(labels.userIdLabels.get('2112000164'), 'diven')

  const entities = await enrichActionEntitiesWithUsernames(sql, [
    {
      kind: 'account',
      value: '0x7a98a2a5c810258b5bb469f3a15888b8e4ea4faa79b0d558cc397d3de1b998fb',
      label: 'wallet',
    },
  ])

  assert.deepEqual(entities, [
    {
      kind: 'account',
      value: '0x7a98a2a5c810258b5bb469f3a15888b8e4ea4faa79b0d558cc397d3de1b998fb',
      label: 'wallet',
      displayValue: 'diven',
    },
  ])
})
