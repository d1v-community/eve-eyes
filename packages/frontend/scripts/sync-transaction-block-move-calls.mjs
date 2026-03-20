import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env.mjs'
import { createSqlClient } from '../src/app/server/db/client.mjs'
import { runPendingMigrations } from '../src/app/server/db/migrations.mjs'
import {
  createRpcPool,
  extractMoveCalls,
  runWithConcurrency,
} from './sui-rpc-sync-helpers.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(projectRoot, '..', '..')
const migrationsDirectory = path.join(projectRoot, 'db', 'migrations')

async function fetchPendingRows(sql, limit) {
  return sql`
    SELECT t.digest
    FROM transaction_blocks AS t
    WHERE NOT EXISTS (
      SELECT 1
      FROM suiscan_move_calls AS s
      WHERE s.tx_digest = t.digest
    )
    ORDER BY t.created_at ASC
    LIMIT ${limit}
  `
}

async function syncDigest(sql, rpcPool, txDigest) {
  const { result, rpcUrl } = await rpcPool.getTransactionBlock({
    digest: txDigest,
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
    },
  })

  const moveCalls = extractMoveCalls(result)

  if (moveCalls.length === 0) {
    return {
      moveCallCount: 0,
      rpcUrl,
    }
  }

  await sql.begin(async (transaction) => {
    await transaction`
      DELETE FROM suiscan_move_calls
      WHERE tx_digest = ${txDigest}
    `

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
      `,
      values
    )
  })

  return {
    moveCallCount: moveCalls.length,
    rpcUrl,
  }
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(projectRoot)

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
      syncedCount += 1
      moveCallCount += result.moveCallCount
      rpcUsage.set(result.rpcUrl, (rpcUsage.get(result.rpcUrl) ?? 0) + 1)
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
