import path from 'node:path'
import { loadProjectEnv } from '../scripts/load-env.mjs'
import { buildTransactionBlockRecord, transactionBlockReferencesPackage } from './parser.mjs'
import { upsertTransactionBlock } from './db.mjs'
import { syncDerivedRecordsForTransactionBlockInTransaction } from './derived-record-sync.mjs'
import { syncUserActivityRecordsForTransactionBlockInTransaction } from './user-activity-sync.mjs'

export async function bootstrapIndexerEnv(config) {
  await loadProjectEnv(config.repoRoot)
  await loadProjectEnv(config.packageRoot)
  await loadProjectEnv(config.frontendRoot)
}

export function getMigrationsDirectory(config) {
  return path.join(config.frontendRoot, 'db', 'migrations')
}

export async function processTransactionBlock(sql, config, txBlock, logger, options = {}) {
  const rpcPool = options.rpcPool ?? null
  const syncDerivedRecords = options.syncDerivedRecords === true
  const syncUserActivities = options.syncUserActivities === true
  const transactionTime =
    txBlock?.timestampMs == null
      ? null
      : new Date(Number(txBlock.timestampMs)).toISOString()

  if (!transactionBlockReferencesPackage(txBlock, config.packageId)) {
    return {
      stored: false,
      digest: txBlock?.digest ?? null,
      checkpoint: txBlock?.checkpoint == null ? null : String(txBlock.checkpoint),
      executedAt: transactionTime,
      transactionTime,
    }
  }

  const record = buildTransactionBlockRecord(txBlock, config)

  if (syncDerivedRecords || syncUserActivities) {
    const syncResult = await sql.begin(async (transaction) => {
      await upsertTransactionBlock(transaction, record, config, logger)
      const derivedResult = syncDerivedRecords
        ? await syncDerivedRecordsForTransactionBlockInTransaction(
            transaction,
            rpcPool,
            config.packageId,
            record
          )
        : {
            skipped: true,
            characterChangeCount: 0,
            killmailCount: 0,
            rpcUsage: [],
          }
      const activityResult = syncUserActivities
        ? await syncUserActivityRecordsForTransactionBlockInTransaction(
            transaction,
            config.packageId,
            record
          )
        : {
            skipped: true,
            activityCount: 0,
            participantCount: 0,
          }

      return {
        derivedResult,
        activityResult,
      }
    })

    return {
      stored: true,
      digest: record.digest,
      checkpoint: record.checkpoint,
      executedAt: record.executedAt,
      transactionTime: record.transactionTime,
      derivedSynced: !syncResult.derivedResult.skipped,
      characterChangeCount: syncResult.derivedResult.characterChangeCount,
      killmailCount: syncResult.derivedResult.killmailCount,
      activitySynced: !syncResult.activityResult.skipped,
      activityCount: syncResult.activityResult.activityCount,
      participantCount: syncResult.activityResult.participantCount,
    }
  }

  await upsertTransactionBlock(sql, record, config, logger)

  return {
    stored: true,
    digest: record.digest,
    checkpoint: record.checkpoint,
    executedAt: record.executedAt,
    transactionTime: record.transactionTime,
    derivedSynced: false,
    characterChangeCount: 0,
    killmailCount: 0,
    activitySynced: false,
    activityCount: 0,
    participantCount: 0,
  }
}
