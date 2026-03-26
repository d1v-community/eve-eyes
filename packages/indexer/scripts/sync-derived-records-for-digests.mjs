import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env.mjs'
import { getIndexerConfig } from '../src/config.mjs'
import { processTransactionBlock } from '../src/ingest.mjs'
import { createLogger, createRpcPool } from './sui-rpc-sync-helpers.mjs'
import {
  resolvePendingBuildingInstances,
  resolvePendingKillmailRecords,
  syncDerivedRecordsForTransactionBlock,
} from '../src/derived-record-sync.mjs'
import { createSqlClient } from '../../frontend/src/app/server/db/client.mjs'
import { runPendingMigrations } from '../../frontend/src/app/server/db/migrations.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')
const frontendRoot = path.join(repoRoot, 'packages', 'frontend')
const migrationsDirectory = path.join(frontendRoot, 'db', 'migrations')

async function fetchTransactionBlockRow(sql, digest) {
  const rows = await sql`
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
    WHERE digest = ${digest}
    LIMIT 1
  `

  return rows[0] ?? null
}

async function ensureIndexedTransactionBlock(sql, rpcPool, config, digest, logger) {
  let row = await fetchTransactionBlockRow(sql, digest)

  if (row) {
    return row
  }

  const { result, rpcUrl } = await rpcPool.getTransactionBlock({
    digest,
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true,
      showRawInput: true,
    },
  })

  const storeResult = await processTransactionBlock(sql, config, result, logger)

  logger.info('indexed missing transaction block for derived sync', {
    digest,
    stored: storeResult.stored,
    rpcUrl,
  })

  row = await fetchTransactionBlockRow(sql, digest)

  if (!row) {
    throw new Error(`transaction ${digest} could not be indexed into transaction_blocks`)
  }

  await sql`
    UPDATE transaction_blocks
    SET derived_records_synced_at = NULL
    WHERE digest = ${digest}
  `

  return row
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)
  await loadProjectEnv(frontendRoot)

  const digests = process.argv.slice(2).map((item) => item.trim()).filter(Boolean)

  if (digests.length === 0) {
    throw new Error('Provide at least one transaction digest')
  }

  const config = getIndexerConfig()
  const logger = createLogger('sync-derived-records-for-digests')
  const sql = createSqlClient(undefined, {
    max: 4,
  })
  const rpcPool = createRpcPool()

  try {
    await runPendingMigrations(sql, migrationsDirectory)

    let syncedCount = 0
    let skippedCount = 0
    let buildingChangeCount = 0
    let buildingOwnerCapChangeCount = 0
    let characterChangeCount = 0
    let killmailCount = 0

    for (const digest of digests) {
      const row = await ensureIndexedTransactionBlock(sql, rpcPool, config, digest, logger)

      await sql`
        UPDATE transaction_blocks
        SET derived_records_synced_at = NULL
        WHERE digest = ${digest}
      `

      const refreshedRow = await fetchTransactionBlockRow(sql, digest)

      if (!refreshedRow) {
        throw new Error(`transaction ${digest} disappeared before derived sync`)
      }

      const result = await syncDerivedRecordsForTransactionBlock(
        sql,
        rpcPool,
        config.packageId,
        refreshedRow
      )

      if (result.skipped) {
        skippedCount += 1
        continue
      }

      syncedCount += 1
      buildingChangeCount += result.buildingChangeCount
      buildingOwnerCapChangeCount += result.buildingOwnerCapChangeCount
      characterChangeCount += result.characterChangeCount
      killmailCount += result.killmailCount
    }

    const buildingResolution = await resolvePendingBuildingInstances(sql, 500)
    const resolution = await resolvePendingKillmailRecords(sql, 500)

    logger.info('targeted derived-record sync completed', {
      digests,
      syncedCount,
      skippedCount,
      buildingChangeCount,
      buildingOwnerCapChangeCount,
      resolvedBuildingOwnerCount: buildingResolution.resolvedCount,
      characterChangeCount,
      killmailCount,
      resolvedKillmailCount: resolution.resolvedCount,
      pendingKillmailCount: resolution.pendingCount,
    })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(
    '[sync-derived-records-for-digests] fatal error',
    error instanceof Error ? error.stack ?? error.message : String(error)
  )
  process.exitCode = 1
})
