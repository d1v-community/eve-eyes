import test from 'node:test'
import assert from 'node:assert/strict'
import { parseUserActivityFilters } from '../src/app/server/indexer/user-activity-repository.mjs'

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
