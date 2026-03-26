import {
  closeBuildingInstance,
  closeCharacterIdentity,
  extractBuildingInstanceSnapshot,
  extractBuildingObjectChanges,
  extractBuildingOwnerCapChanges,
  extractCharacterCreatedSnapshots,
  extractCharacterObjectChanges,
  extractKillmailEvents,
  resolvePendingBuildingInstances,
  resolvePendingKillmailRecords,
  resolveSourceTimestamp,
  updateBuildingOwnerFromOwnerCap,
  upsertBuildingInstance,
  upsertCharacterIdentity,
  upsertKillmailRecord,
} from './derived-records.mjs'

async function fetchBuildingSnapshot(rpcPool, packageId, change, rpcUsage) {
  const { result, rpcUrl } = await rpcPool.tryGetPastObject({
    id: change.objectId,
    version: String(change.version),
    options: {
      showType: true,
      showOwner: true,
      showContent: true,
    },
  })

  rpcUsage.push(rpcUrl)

  const snapshot = extractBuildingInstanceSnapshot(result, packageId)

  if (snapshot) {
    return snapshot
  }

  try {
    const { result: currentResult, rpcUrl: currentRpcUrl } = await rpcPool.getObject({
      id: change.objectId,
      options: {
        showType: true,
        showOwner: true,
        showContent: true,
      },
    })

    rpcUsage.push(currentRpcUrl)

    return extractBuildingInstanceSnapshot(currentResult, packageId)
  } catch {
    return null
  }
}

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
          buildingChangeCount: 0,
          buildingOwnerCapChangeCount: 0,
          characterChangeCount: 0,
          killmailCount: 0,
          rpcUsage: [],
      }
    }

    const characterChanges = extractCharacterObjectChanges(
      row.object_changes,
      packageId
    )
    const buildingChanges = extractBuildingObjectChanges(row.object_changes, packageId)
    const buildingOwnerCapChanges = extractBuildingOwnerCapChanges(
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

    const ownerCapChangeById = new Map(
      buildingOwnerCapChanges.map((change) => [change.ownerCapId, change])
    )

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

    for (const change of buildingChanges) {
      if (change.kind === 'delete') {
        await closeBuildingInstance(transaction, {
          buildingObjectId: change.objectId,
          sourceTxDigest: row.digest,
          sourceTxTimestamp,
        })
        continue
      }

      const snapshot = await fetchBuildingSnapshot(
        rpcPool,
        packageId,
        change,
        rpcUsage
      )

      if (!snapshot) {
        continue
      }

      const ownerCapChange = ownerCapChangeById.get(snapshot.ownerCapId)

      await upsertBuildingInstance(transaction, snapshot, {
        sourceTxDigest: row.digest,
        sourceTxTimestamp,
        ownerCharacterObjectId: ownerCapChange?.ownerCharacterObjectId ?? null,
      })
    }

    for (const ownerCapChange of buildingOwnerCapChanges) {
      await updateBuildingOwnerFromOwnerCap(transaction, {
        ownerCapId: ownerCapChange.ownerCapId,
        ownerCharacterObjectId: ownerCapChange.ownerCharacterObjectId,
        sourceTxDigest: row.digest,
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
        buildingChangeCount: buildingChanges.length,
        buildingOwnerCapChangeCount: buildingOwnerCapChanges.length,
        characterChangeCount:
          characterCreateSnapshots.length +
          characterChanges.filter((change) => change.kind === 'delete').length,
      killmailCount: killmailEvents.length,
      rpcUsage,
    }
  })
}

export { resolvePendingBuildingInstances, resolvePendingKillmailRecords }
