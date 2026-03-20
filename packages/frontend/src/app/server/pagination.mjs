import {
  getDefaultPageSize,
  getFreePageLimit,
  getMaxPageSize,
} from './auth/config.mjs'

function parseInteger(value, fallback, label) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback
  }

  const parsed = Number.parseInt(String(value), 10)

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }

  return parsed
}

export function parsePagination(searchParams) {
  const page = parseInteger(searchParams.get('page'), 1, 'page')
  const requestedPageSize = parseInteger(
    searchParams.get('pageSize'),
    getDefaultPageSize(),
    'pageSize'
  )
  const pageSize = Math.min(requestedPageSize, getMaxPageSize())
  const offset = (page - 1) * pageSize

  return {
    page,
    pageSize,
    offset,
    freePageLimit: getFreePageLimit(),
  }
}

export function requirePageAccess(pagination, auth) {
  if (pagination.page <= pagination.freePageLimit) {
    return
  }

  if (auth.type === 'anonymous') {
    throw new Error('authentication is required for this page')
  }
}
