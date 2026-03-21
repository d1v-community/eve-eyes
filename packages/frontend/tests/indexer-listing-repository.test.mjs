import test from 'node:test'
import assert from 'node:assert/strict'
import {
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
