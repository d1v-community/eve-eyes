import postgres from 'postgres'
import { getDatabaseConnectTimeoutSeconds } from '../auth/config.mjs'

const globalKey = '__sdsSqlClient'

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured')
  }

  return databaseUrl
}

function resolvePoolMax(explicitMax) {
  if (explicitMax !== undefined) {
    return explicitMax
  }

  const configured = process.env.DATABASE_POOL_MAX?.trim()

  if (!configured) {
    return 1
  }

  const parsed = Number.parseInt(configured, 10)

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error('DATABASE_POOL_MAX must be a positive integer')
  }

  return parsed
}

export function createSqlClient(databaseUrl = getDatabaseUrl(), options = {}) {
  return postgres(databaseUrl, {
    ssl: 'require',
    max: resolvePoolMax(options.max),
    idle_timeout: 20,
    connect_timeout: getDatabaseConnectTimeoutSeconds(),
    prepare: false,
  })
}

export function getSqlClient() {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = createSqlClient()
  }

  return globalThis[globalKey]
}

export async function closeSqlClient() {
  if (!globalThis[globalKey]) {
    return
  }

  await globalThis[globalKey].end({ timeout: 5 })
  globalThis[globalKey] = undefined
}
