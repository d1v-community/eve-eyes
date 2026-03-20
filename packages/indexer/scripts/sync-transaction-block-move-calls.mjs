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
      AND NOT EXISTS (
        SELECT 1
        FROM suiscan_move_calls AS smc
        WHERE smc.tx_digest = t.digest
      )
    ORDER BY t.created_at ASC
    LIMIT ${limit}
  `
}

function chunkArray(items, chunkSize) {
  const chunks = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

async function fetchTransactionBlocksByDigest(rpcPool, digests, concurrency) {
  const txBlocksByDigest = new Map()
  const rpcUsage = new Map()
  const chunkSize = Math.max(1, concurrency * 4)

  for (const digestChunk of chunkArray(digests, chunkSize)) {
    try {
      const { result, rpcUrl } = await rpcPool.multiGetTransactionBlocks({
        digests: digestChunk,
        options: {
          showInput: true,
          showEffects: true,
          showEvents: true,
        },
      })

      for (const txBlock of result) {
        if (txBlock?.digest) {
          txBlocksByDigest.set(txBlock.digest, txBlock)
        }
      }

      rpcUsage.set(rpcUrl, (rpcUsage.get(rpcUrl) ?? 0) + digestChunk.length)
      continue
    } catch (error) {
      console.error(
        '[sync-transaction-block-move-calls] batch fetch failed, falling back to single fetches',
        error instanceof Error ? error.message : String(error)
      )
    }

    await runWithConcurrency(digestChunk, concurrency, async (digest) => {
      const { result, rpcUrl } = await rpcPool.getTransactionBlock({
        digest,
        options: {
          showInput: true,
          showEffects: true,
          showEvents: true,
        },
      })

      txBlocksByDigest.set(digest, result)
      rpcUsage.set(rpcUrl, (rpcUsage.get(rpcUrl) ?? 0) + 1)
    })
  }

  return {
    txBlocksByDigest,
    rpcUsage,
  }
}

async function syncDigest(sql, txDigest, txBlock) {
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

    const moveCalls = extractMoveCalls(txBlock)

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

  const sql = createSqlClient(undefined, {
    max: Math.max(concurrency + 1, 6),
  })
  const rpcPool = createRpcPool()

  try {
    await runPendingMigrations(sql, migrationsDirectory)

    const txRows = await fetchPendingRows(sql, limit)
    const digests = txRows.map((row) => row.digest)
    const { txBlocksByDigest, rpcUsage } = await fetchTransactionBlocksByDigest(
      rpcPool,
      digests,
      concurrency
    )
    let syncedCount = 0
    let moveCallCount = 0
    let skippedCount = 0
    let completedCount = 0
    const totalCount = txRows.length

    function renderProgress() {
      const width = 24
      const ratio = totalCount === 0 ? 1 : completedCount / totalCount
      const filled = Math.round(ratio * width)
      const bar = `${'#'.repeat(filled)}${'-'.repeat(width - filled)}`
      process.stdout.write(
        `\r[sync-transaction-block-move-calls] progress [${bar}] ${completedCount}/${totalCount}`
      )
    }

    renderProgress()

    await runWithConcurrency(txRows, concurrency, async (row) => {
      const txBlock = txBlocksByDigest.get(row.digest)

      if (!txBlock) {
        skippedCount += 1
        completedCount += 1
        renderProgress()
        return
      }

      const result = await syncDigest(sql, row.digest, txBlock)
      if (result.skipped) {
        skippedCount += 1
        completedCount += 1
        renderProgress()
        return
      }
      syncedCount += 1
      moveCallCount += result.moveCallCount
      completedCount += 1
      renderProgress()
    })

    process.stdout.write('\n')

    console.log(`synced: ${syncedCount}`)
    console.log(`move_calls: ${moveCallCount}`)
    console.log(`skipped: ${skippedCount}`)
    console.log(`total: ${totalCount}`)
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
