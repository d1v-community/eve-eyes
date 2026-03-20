import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env.mjs'
import { createSqlClient } from '../../frontend/src/app/server/db/client.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')
const frontendRoot = path.join(repoRoot, 'packages', 'frontend')

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)
  await loadProjectEnv(frontendRoot)

  const sql = createSqlClient()

  try {
    const rows = await sql`
      SELECT
        t.digest,
        t.network,
        t.status,
        t.error_message,
        t.checkpoint,
        t.executed_at,
        t.created_at,
        t.updated_at,
        COUNT(smc.*)::int AS move_call_count
      FROM transaction_blocks AS t
      JOIN suiscan_move_calls AS smc
        ON smc.tx_digest = t.digest
      WHERE COALESCE(t.status, '') <> 'success'
      GROUP BY
        t.digest,
        t.network,
        t.status,
        t.error_message,
        t.checkpoint,
        t.executed_at,
        t.created_at,
        t.updated_at
      ORDER BY t.executed_at DESC NULLS LAST, t.updated_at DESC
    `

    console.log(`failed_transactions_with_move_calls: ${rows.length}`)

    for (const row of rows) {
      console.log(
        JSON.stringify({
          digest: row.digest,
          network: row.network,
          status: row.status,
          errorMessage: row.error_message,
          checkpoint: row.checkpoint,
          executedAt: row.executed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          moveCallCount: row.move_call_count,
        })
      )
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(
    '[find-failed-transactions-with-move-calls] fatal error',
    error instanceof Error ? error.stack ?? error.message : String(error)
  )
  process.exitCode = 1
})
