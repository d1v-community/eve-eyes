import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyRpcRequestTimeout,
  normalizeRpcRequestTimeoutMs,
} from '../../indexer/scripts/sui-rpc-sync-helpers.mjs'

test('normalizeRpcRequestTimeoutMs returns a safe positive integer timeout', () => {
  assert.equal(normalizeRpcRequestTimeoutMs(undefined), 10_000)
  assert.equal(normalizeRpcRequestTimeoutMs('15000'), 15_000)
  assert.equal(normalizeRpcRequestTimeoutMs(' 2500 '), 2500)
  assert.equal(normalizeRpcRequestTimeoutMs('0'), 10_000)
  assert.equal(normalizeRpcRequestTimeoutMs('bad'), 10_000)
})

test('applyRpcRequestTimeout adds an abort signal when the request does not provide one', () => {
  const timedInput = applyRpcRequestTimeout(
    {
      id: '0x123',
    },
    5000
  )

  assert.equal(timedInput.id, '0x123')
  assert.ok(timedInput.signal)
  assert.equal(typeof timedInput.signal.addEventListener, 'function')
  assert.equal(timedInput.signal.aborted, false)
})
