import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { loadProjectEnv } from './load-env.mjs'
import { createSqlClient } from '../src/app/server/db/client.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(projectRoot, '..', '..')
const syncScriptPath = path.join(projectRoot, 'scripts', 'sync-suiscan-rpc.mjs')

function createLogger(scope) {
  return {
    info(message, details) {
      if (details === undefined) {
        console.log(`[${scope}] ${message}`)
        return
      }

      console.log(`[${scope}] ${message}`, details)
    },
    error(message, error) {
      console.error(
        `[${scope}] ${message}`,
        error instanceof Error ? error.stack ?? error.message : error
      )
    },
  }
}

async function getProgressSnapshot() {
  const sql = createSqlClient()

  try {
    const rows = await sql`
      SELECT
        COUNT(*) FILTER (WHERE record_type = 'tx' AND tx_status IS NOT NULL)::int AS tx_with_status,
        COUNT(*) FILTER (WHERE record_type = 'tx')::int AS tx_total
      FROM suiscan_records
    `

    const moveRows = await sql`
      SELECT COUNT(*)::int AS move_call_rows
      FROM suiscan_move_calls
    `

    return {
      txWithStatus: rows[0]?.tx_with_status ?? 0,
      txTotal: rows[0]?.tx_total ?? 0,
      moveCallRows: moveRows[0]?.move_call_rows ?? 0,
    }
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

  logger.info('started sync process', {
    pid: child.pid,
    limit,
    concurrency,
  })

  return child
}

async function stopSyncProcess(child, logger) {
  if (!child || child.exitCode !== null || child.killed) {
    return
  }

  logger.info('stopping sync process', { pid: child.pid })
  child.kill('SIGTERM')

  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(5000),
  ])

  if (child.exitCode === null && !child.killed) {
    logger.info('forcing sync process shutdown', { pid: child.pid })
    child.kill('SIGKILL')
  }
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(projectRoot)

  const logger = createLogger('watch-sync-suiscan-rpc')
  const limit = Number.parseInt(process.argv[2] ?? '20000', 10)
  const concurrency = Number.parseInt(process.argv[3] ?? '5', 10)
  const checkIntervalMs = Number.parseInt(process.argv[4] ?? '30000', 10)
  const maxIdleChecks = Number.parseInt(process.argv[5] ?? '4', 10)

  if (
    [limit, concurrency, checkIntervalMs, maxIdleChecks].some(
      (value) => Number.isNaN(value) || value <= 0
    )
  ) {
    throw new Error(
      'limit, concurrency, checkIntervalMs, and maxIdleChecks must be positive integers'
    )
  }

  let child = startSyncProcess(limit, concurrency, logger)
  let previousSnapshot = await getProgressSnapshot()
  let idleChecks = 0

  logger.info('initial progress snapshot', previousSnapshot)

  process.on('SIGINT', async () => {
    logger.info('received SIGINT, shutting down')
    await stopSyncProcess(child, logger)
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    logger.info('received SIGTERM, shutting down')
    await stopSyncProcess(child, logger)
    process.exit(0)
  })

  while (true) {
    await delay(checkIntervalMs)

    const currentSnapshot = await getProgressSnapshot()
    const hasProgress =
      currentSnapshot.txWithStatus > previousSnapshot.txWithStatus ||
      currentSnapshot.moveCallRows > previousSnapshot.moveCallRows

    logger.info('progress check', {
      currentSnapshot,
      hasProgress,
      idleChecks,
      processRunning: child.exitCode === null && !child.killed,
    })

    if (currentSnapshot.txWithStatus >= currentSnapshot.txTotal) {
      logger.info('sync completed, stopping watcher', currentSnapshot)
      await stopSyncProcess(child, logger)
      return
    }

    if (hasProgress) {
      previousSnapshot = currentSnapshot
      idleChecks = 0
      continue
    }

    idleChecks += 1

    const processStopped = child.exitCode !== null || child.killed
    const shouldRestart = processStopped || idleChecks >= maxIdleChecks

    if (!shouldRestart) {
      continue
    }

    logger.info('restarting sync process', {
      processStopped,
      idleChecks,
      previousSnapshot,
      currentSnapshot,
    })

    await stopSyncProcess(child, logger)
    child = startSyncProcess(limit, concurrency, logger)
    previousSnapshot = await getProgressSnapshot()
    idleChecks = 0
  }
}

main().catch((error) => {
  console.error(
    '[watch-sync-suiscan-rpc] fatal error',
    error instanceof Error ? error.stack ?? error.message : error
  )
  process.exitCode = 1
})
