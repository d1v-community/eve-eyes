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
  'sync-transaction-block-user-activities.mjs'
)

async function getPendingCount() {
  const sql = createSqlClient()

  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS pending_count
      FROM transaction_blocks
      WHERE user_activity_synced_at IS NULL
    `

    return rows[0]?.pending_count ?? 0
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function startSyncProcess(limit, logger) {
  const child = spawn(process.execPath, [syncScriptPath, String(limit)], {
    cwd: packageRoot,
    stdio: 'inherit',
    env: process.env,
  })

  logger.info('started user-activity sync process', {
    pid: child.pid,
    limit,
  })

  return child
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)

  const logger = createLogger('watch-transaction-block-user-activities')
  const limit = Number.parseInt(process.argv[2] ?? '250', 10)
  const checkIntervalMs = 90000
  let child = null

  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer')
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
    const pendingCount = await getPendingCount()

    logger.info('pending user-activity check', {
      pendingCount,
      processRunning: Boolean(child && child.exitCode === null && !child.killed),
      checkIntervalMs,
    })

    if (pendingCount > 0 && (!child || child.exitCode !== null || child.killed)) {
      child = startSyncProcess(limit, logger)
    }

    await delay(checkIntervalMs)
  }
}

main().catch((error) => {
  console.error(
    '[watch-transaction-block-user-activities] fatal error',
    error instanceof Error ? error.stack ?? error.message : String(error)
  )
  process.exitCode = 1
})
