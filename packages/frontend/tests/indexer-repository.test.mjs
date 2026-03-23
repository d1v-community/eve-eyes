import test from 'node:test'
import assert from 'node:assert/strict'
import { getModuleCallCounts } from '../src/app/server/indexer/repository.mjs'

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
