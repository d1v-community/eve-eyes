import test from 'node:test'
import assert from 'node:assert/strict'
import {
  listCharacterCreations,
  parseMoveCallFilters,
  parseTransactionBlockFilters,
} from '../src/app/server/indexer/listing-repository.mjs'

test('parseTransactionBlockFilters trims text filters and parses checkpoint', () => {
  const filters = parseTransactionBlockFilters(
    new URLSearchParams({
      network: ' mainnet ',
      senderAddress: ' 0xabc ',
      status: ' success ',
      digest: ' digest-1 ',
      transactionKind: ' ProgrammableTransaction ',
      checkpoint: '42',
    })
  )

  assert.deepEqual(filters, {
    network: 'mainnet',
    senderAddress: '0xabc',
    status: 'success',
    digest: 'digest-1',
    transactionKind: 'ProgrammableTransaction',
    checkpoint: 42,
  })
})

test('parseMoveCallFilters trims text filters and parses callIndex', () => {
  const filters = parseMoveCallFilters(
    new URLSearchParams({
      network: ' testnet ',
      senderAddress: ' 0xdef ',
      status: ' failure ',
      txDigest: ' tx-1 ',
      packageId: ' 0x2 ',
      moduleName: ' world ',
      functionName: ' jump ',
      callIndex: '0',
    })
  )

  assert.deepEqual(filters, {
    network: 'testnet',
    senderAddress: '0xdef',
    status: 'failure',
    txDigest: 'tx-1',
    packageId: '0x2',
    moduleName: 'world',
    functionName: 'jump',
    callIndex: 0,
  })
})

test('parseMoveCallFilters rejects invalid callIndex values', () => {
  assert.throws(
    () => parseMoveCallFilters(new URLSearchParams({ callIndex: '-1' })),
    /callIndex must be a non-negative integer/
  )
})

test('listCharacterCreations decodes create_character arguments into structured rows', async () => {
  const sql = Object.assign(
    async (strings) => {
      const text = strings.join(' ')

      if (text.includes('SELECT COUNT(*)::int AS total')) {
        return [{ total: 1 }]
      }

      throw new Error(`Unexpected tagged query: ${text}`)
    },
    {
      unsafe: async (text, values) => {
        assert.match(text, /FROM suiscan_move_calls AS smc/)
        assert.deepEqual(values, [20, 0])

        return [
          {
            id: 1,
            tx_digest: '9txDigest',
            call_index: 17,
            transaction_time: '2026-03-28T02:27:00.000Z',
            raw_call: {
              package: '0xpackage',
              module: 'character',
              function: 'create_character',
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
      },
    }
  )

  const result = await listCharacterCreations(sql, {
    pageSize: 20,
    offset: 0,
  })

  assert.deepEqual(result, {
    items: [
      {
        id: '1',
        txDigest: '9txDigest',
        callIndex: 17,
        transactionTime: '2026-03-28T02:27:00.000Z',
        userId: '2112000164',
        tenant: 'utopia',
        tribeId: '1000167',
        walletAddress:
          '0x7a98a2a5c810258b5bb469f3a15888b8e4ea4faa79b0d558cc397d3de1b998fb',
        username: 'diven',
      },
    ],
    total: 1,
  })
})
