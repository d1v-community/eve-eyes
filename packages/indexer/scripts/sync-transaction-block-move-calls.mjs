import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env.mjs'
import { createSqlClient } from '../../frontend/src/app/server/db/client.mjs'
import { runPendingMigrations } from '../../frontend/src/app/server/db/migrations.mjs'
import {
  createRpcPool,
  extractMoveCalls,
  runWithConcurrency,
} from './sui-rpc-sync-helpers.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')
const frontendRoot = path.join(repoRoot, 'packages', 'frontend')
const migrationsDirectory = path.join(frontendRoot, 'db', 'migrations')

async function fetchPendingRows(sql, limit) {
  return sql`
    SELECT t.digest
    FROM transaction_blocks AS t
    WHERE t.move_calls_synced_at IS NULL
    ORDER BY t.created_at ASC
    LIMIT ${limit}
  `
}

async function syncDigest(sql, rpcPool, txDigest) {
  return sql.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(hashtextextended(${txDigest}, 0))
    `

    const syncStateRows = await transaction`
      SELECT move_calls_synced_at
      FROM transaction_blocks
      WHERE digest = ${txDigest}
      LIMIT 1
    `

    if (syncStateRows[0]?.move_calls_synced_at) {
      return {
        moveCallCount: 0,
        rpcUrl: null,
        skipped: true,
      }
    }

    const { result, rpcUrl } = await rpcPool.getTransactionBlock({
      digest: txDigest,
      options: {
        showInput: true,
        showEffects: true,
        showEvents: true,
      },
    })

    const moveCalls = extractMoveCalls(result)

    await transaction`
      DELETE FROM suiscan_move_calls
      WHERE tx_digest = ${txDigest}
    `

    if (moveCalls.length > 0) {
      const values = []
      const placeholders = moveCalls.map((moveCall, rowIndex) => {
        const offset = rowIndex * 6
        values.push(
          txDigest,
          moveCall.callIndex,
          moveCall.packageId,
          moveCall.moduleName,
          moveCall.functionName,
          JSON.stringify(moveCall.rawCall)
        )

        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}::jsonb)`
      })

      await transaction.unsafe(
        `
        INSERT INTO suiscan_move_calls (
          tx_digest,
          call_index,
          package_id,
          module_name,
          function_name,
          raw_call
        )
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (tx_digest, call_index)
        DO UPDATE SET
          package_id = EXCLUDED.package_id,
          module_name = EXCLUDED.module_name,
          function_name = EXCLUDED.function_name,
          raw_call = EXCLUDED.raw_call
        `,
        values
      )
    }

    await transaction`
      UPDATE transaction_blocks
      SET move_calls_synced_at = NOW()
      WHERE digest = ${txDigest}
    `

    return {
      moveCallCount: moveCalls.length,
      rpcUrl,
      skipped: false,
    }
  })
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)
  await loadProjectEnv(frontendRoot)

  const limit = Number.parseInt(process.argv[2] ?? '500', 10)
  const concurrency = Number.parseInt(process.argv[3] ?? '5', 10)

  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer')
  }

  if (Number.isNaN(concurrency) || concurrency <= 0) {
    throw new Error('concurrency must be a positive integer')
  }

  const sql = createSqlClient()
  const rpcPool = createRpcPool()

  try {
    await runPendingMigrations(sql, migrationsDirectory)

    const txRows = await fetchPendingRows(sql, limit)
    let syncedCount = 0
    let moveCallCount = 0
    const rpcUsage = new Map()

    await runWithConcurrency(txRows, concurrency, async (row) => {
      const result = await syncDigest(sql, rpcPool, row.digest)
      if (result.skipped) {
        return
      }
      syncedCount += 1
      moveCallCount += result.moveCallCount
      if (result.rpcUrl) {
        rpcUsage.set(result.rpcUrl, (rpcUsage.get(result.rpcUrl) ?? 0) + 1)
      }
    })

    console.log(`synced: ${syncedCount}`)
    console.log(`move_calls: ${moveCallCount}`)
    console.log(`concurrency: ${concurrency}`)
    console.log(`rpc_urls: ${rpcPool.urls.join(', ')}`)
    console.log(
      `rpc_usage: ${JSON.stringify(Object.fromEntries(rpcUsage.entries()))}`
    )
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.stack ?? error.message : String(error)
  )
  process.exitCode = 1
})
