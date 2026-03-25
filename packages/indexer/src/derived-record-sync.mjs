import {
  closeCharacterIdentity,
  extractCharacterCreatedSnapshots,
  extractCharacterObjectChanges,
  extractKillmailEvents,
  resolvePendingKillmailRecords,
  resolveSourceTimestamp,
  upsertCharacterIdentity,
  upsertKillmailRecord,
} from './derived-records.mjs'

export async function syncDerivedRecordsForTransactionBlock(
  sql,
  rpcPool,
  packageId,
  row
) {
  const sourceTxTimestamp = resolveSourceTimestamp(row)

  if (!sourceTxTimestamp) {
    throw new Error(`transaction ${row.digest} is missing a usable source timestamp`)
  }

  return sql.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(hashtextextended(${row.digest}, 0))
    `

    const syncStateRows = await transaction`
      SELECT derived_records_synced_at
      FROM transaction_blocks
      WHERE digest = ${row.digest}
      LIMIT 1
    `

    if (syncStateRows[0]?.derived_records_synced_at) {
      return {
        skipped: true,
        characterChangeCount: 0,
        killmailCount: 0,
        rpcUsage: [],
      }
    }

    const characterChanges = extractCharacterObjectChanges(
      row.object_changes,
      packageId
    )
    const characterCreateSnapshots = extractCharacterCreatedSnapshots(
      row.events,
      row.object_changes,
      row.effects ?? row.raw_content?.effects ?? null,
      packageId
    )
    const killmailEvents = extractKillmailEvents(row.events, packageId)
    const rpcUsage = []

    for (const snapshot of characterCreateSnapshots) {
      await upsertCharacterIdentity(transaction, snapshot, {
        sourceTxDigest: row.digest,
        sourceTxTimestamp,
        sourceObjectVersion: snapshot.sourceObjectVersion,
      })
    }

    for (const change of characterChanges) {
      if (change.kind !== 'delete') {
        continue
      }

      await closeCharacterIdentity(transaction, {
        characterObjectId: change.objectId,
        sourceTxTimestamp,
      })
    }

    for (const killmailEvent of killmailEvents) {
      await upsertKillmailRecord(transaction, {
        ...killmailEvent,
        txDigest: row.digest,
        txCheckpoint: row.checkpoint == null ? null : String(row.checkpoint),
        txTimestamp: sourceTxTimestamp,
      })
    }

    await transaction`
      UPDATE transaction_blocks
      SET derived_records_synced_at = NOW()
      WHERE digest = ${row.digest}
    `

    return {
      skipped: false,
      characterChangeCount:
        characterCreateSnapshots.length +
        characterChanges.filter((change) => change.kind === 'delete').length,
      killmailCount: killmailEvents.length,
      rpcUsage,
    }
  })
}

export { resolvePendingKillmailRecords }
