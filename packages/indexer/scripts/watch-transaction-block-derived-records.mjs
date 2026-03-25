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

function startSyncProcess(limit, resolveLimit, logger) {
  const child = spawn(
    process.execPath,
    [syncScriptPath, String(limit), String(resolveLimit)],
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
  })

  return child
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)

  const logger = createLogger('watch-transaction-block-derived-records')
  const limit = Number.parseInt(process.argv[2] ?? '250', 10)
  const resolveLimit = Number.parseInt(process.argv[3] ?? '500', 10)
  const checkIntervalMs = 90000
  let child = null

  if ([limit, resolveLimit].some((value) => Number.isNaN(value) || value <= 0)) {
    throw new Error('limit and resolveLimit must be positive integers')
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
    const pendingCount = await getPendingDerivedRecordCount()

    logger.info('pending derived-record check', {
      pendingCount,
      processRunning: Boolean(child && child.exitCode === null && !child.killed),
      checkIntervalMs,
    })

    if (
      pendingCount > 0 &&
      (!child || child.exitCode !== null || child.killed)
    ) {
      child = startSyncProcess(limit, resolveLimit, logger)
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
