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
  'sync-transaction-block-move-calls.mjs'
)

async function getPendingDigestCount() {
  const sql = createSqlClient()

  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS pending_count
      FROM transaction_blocks AS t
      WHERE t.move_calls_synced_at IS NULL
    `

    return rows[0]?.pending_count ?? 0
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function markAlreadySyncedDigests() {
  const sql = createSqlClient()

  try {
    const rows = await sql`
      WITH updated_rows AS (
        UPDATE transaction_blocks AS t
        SET move_calls_synced_at = NOW()
        WHERE t.move_calls_synced_at IS NULL
          AND EXISTS (
            SELECT 1
            FROM suiscan_move_calls AS smc
            WHERE smc.tx_digest = t.digest
          )
        RETURNING t.digest
      )
      SELECT COUNT(*)::int AS marked_count
      FROM updated_rows
    `

    return rows[0]?.marked_count ?? 0
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function startSyncProcess(limit, concurrency, logger) {
  const child = spawn(
    process.execPath,
    [syncScriptPath, String(limit), String(concurrency)],
    {
      cwd: packageRoot,
      stdio: 'inherit',
      env: process.env,
    }
  )

  logger.info('started transaction_blocks sync process', {
    pid: child.pid,
    limit,
    concurrency,
  })

  return child
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)

  const logger = createLogger('watch-transaction-block-move-calls')
  const limit = Number.parseInt(process.argv[2] ?? '500', 10)
  const concurrency = Number.parseInt(process.argv[3] ?? '5', 10)
  const checkIntervalMs = 90000
  let child = null

  if ([limit, concurrency].some((value) => Number.isNaN(value) || value <= 0)) {
    throw new Error('limit and concurrency must be positive integers')
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

  const initiallyMarkedCount = await markAlreadySyncedDigests()
  logger.info('marked already-synced digests on startup', {
    markedCount: initiallyMarkedCount,
  })

  while (true) {
    const markedCount = await markAlreadySyncedDigests()
    const pendingCount = await getPendingDigestCount()

    logger.info('pending digest check', {
      markedCount,
      pendingCount,
      processRunning: Boolean(child && child.exitCode === null && !child.killed),
      checkIntervalMs,
    })

    if (
      pendingCount > 0 &&
      (!child || child.exitCode !== null || child.killed)
    ) {
      child = startSyncProcess(limit, concurrency, logger)
    }

    await delay(checkIntervalMs)
  }
}

main().catch((error) => {
  console.error(
    '[watch-transaction-block-move-calls] fatal error',
    error instanceof Error ? error.stack ?? error.message : error
  )
  process.exitCode = 1
})
