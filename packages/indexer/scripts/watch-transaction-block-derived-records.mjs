import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { loadProjectEnv } from './load-env.mjs'
import { createSqlClient } from '../../frontend/src/app/server/db/client.mjs'
import { createLogger } from './sui-rpc-sync-helpers.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')
const frontendRoot = path.join(repoRoot, 'packages', 'frontend')
const syncScriptPath = path.join(
  packageRoot,
  'scripts',
  'sync-transaction-block-derived-records.mjs'
)

async function getPendingDerivedRecordCount() {
  const sql = createSqlClient()

  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS pending_count
      FROM transaction_blocks
      WHERE derived_records_synced_at IS NULL
    `

    return rows[0]?.pending_count ?? 0
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function isTransientWatcherError(error) {
  const code =
    error && typeof error === 'object' && 'code' in error ? error.code : null
  const message =
    error instanceof Error ? error.message : String(error ?? 'unknown error')

  return (
    code === 'ECONNRESET' ||
    code === 'CONNECTION_CLOSED' ||
    message.includes('ECONNRESET') ||
    message.includes('CONNECTION_CLOSED')
  )
}

function startSyncProcess(
  limit,
  resolveLimit,
  reconcileLimit,
  concurrency,
  logger
) {
  const child = spawn(
    process.execPath,
    [
      syncScriptPath,
      String(limit),
      String(resolveLimit),
      String(concurrency),
      String(reconcileLimit),
    ],
    {
      cwd: packageRoot,
      stdio: 'inherit',
      env: process.env,
    }
  )

  logger.info('started derived-record sync process', {
    pid: child.pid,
    limit,
    resolveLimit,
    reconcileLimit,
    concurrency,
  })

  return child
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)
  await loadProjectEnv(frontendRoot)

  const logger = createLogger('watch-transaction-block-derived-records')
  const limit = Number.parseInt(process.argv[2] ?? '250', 10)
  const resolveLimit = Number.parseInt(process.argv[3] ?? '500', 10)
  const reconcileLimit = Number.parseInt(process.argv[4] ?? '100', 10)
  const concurrency = Number.parseInt(
    process.argv[5] ?? process.env.DERIVED_SYNC_CONCURRENCY ?? '4',
    10
  )
  const checkIntervalMs = Number.parseInt(
    process.argv[6] ?? process.env.DERIVED_SYNC_CHECK_INTERVAL_MS ?? '15000',
    10
  )
  let child = null

  if (
    Number.isNaN(limit) ||
    limit <= 0 ||
    Number.isNaN(concurrency) ||
    concurrency <= 0 ||
    Number.isNaN(resolveLimit) ||
    resolveLimit < 0 ||
    Number.isNaN(reconcileLimit) ||
    reconcileLimit < 0 ||
    Number.isNaN(checkIntervalMs) ||
    checkIntervalMs <= 0
  ) {
    throw new Error(
      'limit, concurrency, and checkIntervalMs must be positive integers; resolveLimit and reconcileLimit must be non-negative integers'
    )
  }

  process.on('SIGINT', () => {
    logger.info('received SIGINT, shutting down watcher')
    if (child && child.exitCode === null && !child.killed) {
      child.kill('SIGTERM')
    }
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    logger.info('received SIGTERM, shutting down watcher')
    if (child && child.exitCode === null && !child.killed) {
      child.kill('SIGTERM')
    }
    process.exit(0)
  })

  while (true) {
    let pendingCount

    try {
      pendingCount = await getPendingDerivedRecordCount()
    } catch (error) {
      logger.error('pending derived-record check failed', {
        message: error instanceof Error ? error.message : String(error),
        transient: isTransientWatcherError(error),
      })
      await delay(checkIntervalMs)
      continue
    }

    logger.info('pending derived-record check', {
      pendingCount,
      processRunning: Boolean(child && child.exitCode === null && !child.killed),
      checkIntervalMs,
    })

    if (
      (pendingCount > 0 || reconcileLimit > 0) &&
      (!child || child.exitCode !== null || child.killed)
    ) {
      child = startSyncProcess(
        limit,
        resolveLimit,
        reconcileLimit,
        concurrency,
        logger
      )
    }

    await delay(checkIntervalMs)
  }
}

main().catch((error) => {
  console.error(
    '[watch-transaction-block-derived-records] fatal error',
    error instanceof Error ? error.stack ?? error.message : error
  )
  process.exitCode = 1
})
