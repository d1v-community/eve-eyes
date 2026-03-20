import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePagination, requirePageAccess } from '../src/app/server/pagination.mjs'

test('parsePagination applies defaults and computes offsets', () => {
  const pagination = parsePagination(new URLSearchParams('page=4&pageSize=7'))

  assert.equal(pagination.page, 4)
  assert.equal(pagination.pageSize, 7)
  assert.equal(pagination.offset, 21)
  assert.equal(pagination.freePageLimit, 3)
})

test('requirePageAccess allows public pages and blocks anonymous deep pages', () => {
  assert.doesNotThrow(() =>
    requirePageAccess(
      {
        page: 3,
        pageSize: 20,
        offset: 40,
        freePageLimit: 3,
      },
      { type: 'anonymous' }
    )
  )

  assert.throws(
    () =>
      requirePageAccess(
        {
          page: 4,
          pageSize: 20,
          offset: 60,
          freePageLimit: 3,
        },
        { type: 'anonymous' }
      ),
    /authentication is required for this page/
  )

  assert.doesNotThrow(() =>
    requirePageAccess(
      {
        page: 4,
        pageSize: 20,
        offset: 60,
        freePageLimit: 3,
      },
      { type: 'jwt' }
    )
  )
})
