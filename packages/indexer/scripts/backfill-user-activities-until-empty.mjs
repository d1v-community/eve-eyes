import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { loadProjectEnv } from './load-env.mjs'
import { createSqlClient } from '../../frontend/src/app/server/db/client.mjs'
import { createLogger } from './sui-rpc-sync-helpers.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')

async function getPendingCount(sql) {
  const rows = await sql`
    SELECT COUNT(*)::int AS pending_count
    FROM transaction_blocks
    WHERE user_activity_synced_at IS NULL
  `

  return rows[0]?.pending_count ?? 0
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)

  const logger = createLogger('backfill-user-activities-until-empty')
  const batchSize = Number.parseInt(process.argv[2] ?? '500', 10)

  if (Number.isNaN(batchSize) || batchSize <= 0) {
    throw new Error('batch size must be a positive integer')
  }

  const sql = createSqlClient(undefined, { max: 2 })

  try {
    let iteration = 0

    while (true) {
      const pendingBefore = await getPendingCount(sql)

      if (pendingBefore === 0) {
        logger.info('user-activity backfill queue is empty', {
          iteration,
        })
        break
      }

      iteration += 1
      logger.info('starting user-activity backfill batch', {
        iteration,
        batchSize,
        pendingBefore,
      })

      await new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [path.join(packageRoot, 'scripts', 'sync-transaction-block-user-activities.mjs'), String(batchSize)],
          {
            cwd: packageRoot,
            stdio: 'inherit',
            env: process.env,
          }
        )

        child.once('error', reject)
        child.once('exit', (code, signal) => {
          if (code === 0) {
            resolve(null)
            return
          }

          reject(
            new Error(
              `sync-transaction-block-user-activities exited with code ${code ?? 'null'} and signal ${signal ?? 'null'}`
            )
          )
        })
      })

      const pendingAfter = await getPendingCount(sql)
      logger.info('completed user-activity backfill batch', {
        iteration,
        batchSize,
        pendingAfter,
        drained: pendingBefore - pendingAfter,
      })

      if (pendingAfter >= pendingBefore) {
        throw new Error(
          `user-activity backlog did not shrink after iteration ${iteration}`
        )
      }
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(
    '[backfill-user-activities-until-empty] fatal error',
    error instanceof Error ? error.stack ?? error.message : String(error)
  )
  process.exitCode = 1
})
