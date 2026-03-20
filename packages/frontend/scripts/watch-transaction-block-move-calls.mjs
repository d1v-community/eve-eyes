import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { loadProjectEnv } from './load-env.mjs'
import { createSqlClient } from '../src/app/server/db/client.mjs'
import { createLogger } from './sui-rpc-sync-helpers.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(projectRoot, '..', '..')
const syncScriptPath = path.join(
  projectRoot,
  'scripts',
  'sync-transaction-block-move-calls.mjs'
)

async function getPendingDigestCount() {
  const sql = createSqlClient()

  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS pending_count
      FROM transaction_blocks AS t
      WHERE NOT EXISTS (
        SELECT 1
        FROM suiscan_move_calls AS s
        WHERE s.tx_digest = t.digest
      )
    `

    return rows[0]?.pending_count ?? 0
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function startSyncProcess(limit, concurrency, logger) {
  const child = spawn(
    process.execPath,
    [syncScriptPath, String(limit), String(concurrency)],
    {
      cwd: projectRoot,
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
  await loadProjectEnv(projectRoot)

  const logger = createLogger('watch-transaction-block-move-calls')
  const limit = Number.parseInt(process.argv[2] ?? '500', 10)
  const concurrency = Number.parseInt(process.argv[3] ?? '5', 10)
  const checkIntervalMs = Number.parseInt(process.argv[4] ?? '10000', 10)
  let child = null

  if (
    [limit, concurrency, checkIntervalMs].some(
      (value) => Number.isNaN(value) || value <= 0
    )
  ) {
    throw new Error(
      'limit, concurrency, and checkIntervalMs must be positive integers'
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
    const pendingCount = await getPendingDigestCount()

    logger.info('pending digest check', {
      pendingCount,
      processRunning: Boolean(child && child.exitCode === null && !child.killed),
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
