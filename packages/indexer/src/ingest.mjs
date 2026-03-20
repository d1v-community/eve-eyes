import path from 'node:path'
import { loadProjectEnv } from '../scripts/load-env.mjs'
import { buildTransactionBlockRecord, transactionBlockReferencesPackage } from './parser.mjs'
import { upsertTransactionBlock } from './db.mjs'

export async function bootstrapIndexerEnv(config) {
  await loadProjectEnv(config.repoRoot)
  await loadProjectEnv(config.packageRoot)
  await loadProjectEnv(config.frontendRoot)
}

export function getMigrationsDirectory(config) {
  return path.join(config.frontendRoot, 'db', 'migrations')
}

export async function processTransactionBlock(sql, config, txBlock, logger) {
  if (!transactionBlockReferencesPackage(txBlock, config.packageId)) {
    return {
      stored: false,
      digest: txBlock?.digest ?? null,
      checkpoint: txBlock?.checkpoint == null ? null : String(txBlock.checkpoint),
      executedAt:
        txBlock?.timestampMs == null
          ? null
          : new Date(Number(txBlock.timestampMs)).toISOString(),
    }
  }

  const record = buildTransactionBlockRecord(txBlock, config)
  await upsertTransactionBlock(sql, record, config, logger)

  return {
    stored: true,
    digest: record.digest,
    checkpoint: record.checkpoint,
    executedAt: record.executedAt,
  }
}
