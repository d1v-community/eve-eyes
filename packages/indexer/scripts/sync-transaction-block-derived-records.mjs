import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env.mjs'
import { getIndexerConfig } from '../src/config.mjs'
import {
  resolvePendingKillmailRecords,
  syncDerivedRecordsForTransactionBlock,
} from '../src/derived-record-sync.mjs'
import { createSqlClient } from '../../frontend/src/app/server/db/client.mjs'
import { runPendingMigrations } from '../../frontend/src/app/server/db/migrations.mjs'
import { createLogger, createRpcPool } from './sui-rpc-sync-helpers.mjs'

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
      checkpoint,
      transaction_time,
      created_at,
      effects,
      events,
      object_changes
    FROM transaction_blocks
    WHERE derived_records_synced_at IS NULL
    ORDER BY transaction_time ASC NULLS LAST, id ASC
    LIMIT ${limit}
  `
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)
  await loadProjectEnv(frontendRoot)

  const config = getIndexerConfig()
  const logger = createLogger('sync-transaction-block-derived-records')
  const limit = Number.parseInt(process.argv[2] ?? '250', 10)
  const resolveLimit = Number.parseInt(process.argv[3] ?? '500', 10)

  if ([limit, resolveLimit].some((value) => Number.isNaN(value) || value <= 0)) {
    throw new Error('limit and resolveLimit must be positive integers')
  }

  const sql = createSqlClient(undefined, {
    max: 4,
  })
  const rpcPool = createRpcPool()

  try {
    await runPendingMigrations(sql, migrationsDirectory)

    const rows = await fetchPendingRows(sql, limit)
    const totalCount = rows.length
    let syncedCount = 0
    let skippedCount = 0
    let characterChangeCount = 0
    let killmailCount = 0
    const rpcUsage = new Map()

    for (const row of rows) {
      const result = await syncDerivedRecordsForTransactionBlock(
        sql,
        rpcPool,
        config.packageId,
        row
      )

      if (result.skipped) {
        skippedCount += 1
        continue
      }

      syncedCount += 1
      characterChangeCount += result.characterChangeCount
      killmailCount += result.killmailCount

      for (const rpcUrl of result.rpcUsage) {
        rpcUsage.set(rpcUrl, (rpcUsage.get(rpcUrl) ?? 0) + 1)
      }
    }

    const resolution = await resolvePendingKillmailRecords(sql, resolveLimit)

    logger.info('derived-record sync completed', {
      totalCount,
      syncedCount,
      skippedCount,
      characterChangeCount,
      killmailCount,
      resolvedKillmailCount: resolution.resolvedCount,
      pendingKillmailCount: resolution.pendingCount,
      rpcUrls: rpcPool.urls,
      rpcUsage: Object.fromEntries(rpcUsage.entries()),
    })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(
    '[sync-transaction-block-derived-records] fatal error',
    error instanceof Error ? error.stack ?? error.message : String(error)
  )
  process.exitCode = 1
})
