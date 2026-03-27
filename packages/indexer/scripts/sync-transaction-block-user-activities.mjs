import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env.mjs'
import { getIndexerConfig } from '../src/config.mjs'
import { syncUserActivityRecordsForTransactionBlock } from '../src/user-activity-sync.mjs'
import { createSqlClient } from '../../frontend/src/app/server/db/client.mjs'
import { runPendingMigrations } from '../../frontend/src/app/server/db/migrations.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')
const frontendRoot = path.join(repoRoot, 'packages', 'frontend')
const migrationsDirectory = path.join(frontendRoot, 'db', 'migrations')

async function fetchPendingRows(sql, limit) {
  return sql`
    SELECT
      id,
      digest,
      transaction_time,
      raw_content,
      events,
      created_at
    FROM transaction_blocks
    WHERE user_activity_synced_at IS NULL
    ORDER BY created_at ASC
    LIMIT ${limit}
  `
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)
  await loadProjectEnv(frontendRoot)

  const limit = Number.parseInt(process.argv[2] ?? '250', 10)

  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer')
  }

  const config = getIndexerConfig()
  const sql = createSqlClient(undefined, { max: 6 })

  try {
    await runPendingMigrations(sql, migrationsDirectory)

    const rows = await fetchPendingRows(sql, limit)
    let syncedCount = 0
    let skippedCount = 0
    let activityCount = 0
    let participantCount = 0

    for (const row of rows) {
      const result = await syncUserActivityRecordsForTransactionBlock(
        sql,
        config.packageId,
        row
      )

      if (result.skipped) {
        skippedCount += 1
        continue
      }

      syncedCount += 1
      activityCount += result.activityCount
      participantCount += result.participantCount
    }

    console.log('[sync-transaction-block-user-activities] completed', {
      syncedCount,
      skippedCount,
      activityCount,
      participantCount,
    })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(
    '[sync-transaction-block-user-activities] fatal error',
    error instanceof Error ? error.stack ?? error.message : String(error)
  )
  process.exitCode = 1
})
