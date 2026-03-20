import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { loadProjectEnv } from './load-env.mjs'
import { createSqlClient } from '../src/app/server/db/client.mjs'
import { runPendingMigrations } from '../src/app/server/db/migrations.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(projectRoot, '..', '..')
const migrationsDirectory = path.join(projectRoot, 'db', 'migrations')
const defaultRpcUrl = getFullnodeUrl('testnet')

function createRpcClient() {
  return new SuiClient({
    url: process.env.SUI_RPC_URL || process.env.SUI_INDEXER_RPC_URL || defaultRpcUrl,
  })
}

function extractMoveCalls(result) {
  const programmableTransactions =
    result?.transaction?.data?.transaction?.transactions

  if (!Array.isArray(programmableTransactions)) {
    return []
  }

  return programmableTransactions.flatMap((entry, callIndex) => {
    const moveCall = entry?.MoveCall

    if (!moveCall || typeof moveCall !== 'object') {
      return []
    }

    return [
      {
        callIndex,
        packageId:
          typeof moveCall.package === 'string' ? moveCall.package : null,
        moduleName:
          typeof moveCall.module === 'string' ? moveCall.module : null,
        functionName:
          typeof moveCall.function === 'string' ? moveCall.function : null,
        rawCall: moveCall,
      },
    ]
  })
}

async function fetchTxRows(sql, limit) {
  return sql`
    SELECT tx_digest
    FROM suiscan_records
    WHERE record_type = 'tx'
      AND tx_status IS NULL
    ORDER BY created_at ASC
    LIMIT ${limit}
  `
}

async function syncDigest(sql, client, txDigest) {
  const result = await client.getTransactionBlock({
    digest: txDigest,
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
    },
  })

  const txStatus = result?.effects?.status?.status ?? null
  const moveCalls = extractMoveCalls(result)

  await sql.begin(async (transaction) => {
    await transaction`
      UPDATE suiscan_records
      SET tx_status = ${txStatus}
      WHERE tx_digest = ${txDigest}
    `

    await transaction`
      DELETE FROM suiscan_move_calls
      WHERE tx_digest = ${txDigest}
    `

    if (moveCalls.length === 0) {
      return
    }

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
    txStatus,
    moveCallCount: moveCalls.length,
  }
}

async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      await worker(items[currentIndex], currentIndex)
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(
    Array.from({ length: workerCount }, () => runWorker())
  )
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(projectRoot)

  const limit = Number.parseInt(process.argv[2] ?? '100', 10)
  const concurrency = Number.parseInt(process.argv[3] ?? '5', 10)

  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer')
  }

  if (Number.isNaN(concurrency) || concurrency <= 0) {
    throw new Error('concurrency must be a positive integer')
  }

  const sql = createSqlClient()
  const client = createRpcClient()

  try {
    await runPendingMigrations(sql, migrationsDirectory)

    const txRows = await fetchTxRows(sql, limit)
    let syncedCount = 0
    let successCount = 0
    let failureCount = 0
    let moveCallCount = 0

    await runWithConcurrency(txRows, concurrency, async (row) => {
      const result = await syncDigest(sql, client, row.tx_digest)
      syncedCount += 1
      moveCallCount += result.moveCallCount

      if (result.txStatus === 'success') {
        successCount += 1
      } else if (result.txStatus) {
        failureCount += 1
      }
    })

    console.log(`synced: ${syncedCount}`)
    console.log(`success: ${successCount}`)
    console.log(`failure_or_other: ${failureCount}`)
    console.log(`move_calls: ${moveCallCount}`)
    console.log(`concurrency: ${concurrency}`)
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
