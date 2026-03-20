const DEFAULT_JWT_TTL_SECONDS = 60 * 60 * 12
const DEFAULT_CHALLENGE_TTL_SECONDS = 60 * 5
const DEFAULT_FREE_PAGE_LIMIT = 3
const DEFAULT_PAGE_SIZE = 20
const DEFAULT_MAX_PAGE_SIZE = 50
const DEFAULT_API_KEY_LIMIT = 10

function parsePositiveInteger(value, fallback, label) {
  if (value === undefined) {
    return fallback
  }

  const normalized = String(value).trim()

  if (!normalized) {
    return fallback
  }

  const parsed = Number.parseInt(normalized, 10)

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }

  return parsed
}

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET?.trim()

  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return 'test-auth-secret-change-me'
    }

    throw new Error('AUTH_SECRET is not configured')
  }

  return secret
}

export function getJwtTtlSeconds() {
  return parsePositiveInteger(
    process.env.JWT_TTL_SECONDS,
    DEFAULT_JWT_TTL_SECONDS,
    'JWT_TTL_SECONDS'
  )
}

export function getChallengeTtlSeconds() {
  return parsePositiveInteger(
    process.env.WALLET_LOGIN_CHALLENGE_TTL_SECONDS,
    DEFAULT_CHALLENGE_TTL_SECONDS,
    'WALLET_LOGIN_CHALLENGE_TTL_SECONDS'
  )
}

export function getFreePageLimit() {
  return parsePositiveInteger(
    process.env.FREE_PAGE_LIMIT,
    DEFAULT_FREE_PAGE_LIMIT,
    'FREE_PAGE_LIMIT'
  )
}

export function getDefaultPageSize() {
  return parsePositiveInteger(
    process.env.DEFAULT_PAGE_SIZE,
    DEFAULT_PAGE_SIZE,
    'DEFAULT_PAGE_SIZE'
  )
}

export function getMaxPageSize() {
  return parsePositiveInteger(
    process.env.MAX_PAGE_SIZE,
    DEFAULT_MAX_PAGE_SIZE,
    'MAX_PAGE_SIZE'
  )
}

export function getMaxApiKeysPerUser() {
  return parsePositiveInteger(
    process.env.MAX_API_KEYS_PER_USER,
    DEFAULT_API_KEY_LIMIT,
    'MAX_API_KEYS_PER_USER'
  )
}
