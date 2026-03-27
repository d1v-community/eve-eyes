import {
  closeBuildingInstance,
  closeCharacterIdentity,
  extractBuildingInstanceSnapshot,
  markBuildingInstanceReconciled,
  reconcileBuildingInstanceState,
  extractBuildingObjectChanges,
  extractBuildingOwnerCapChanges,
  extractCharacterCreatedSnapshots,
  extractCharacterIdentitySnapshot,
  extractCharacterObjectChanges,
  extractKillmailEvents,
  resolvePendingBuildingInstances as resolvePendingBuildingCharacterItems,
  resolvePendingKillmailRecords,
  resolveSourceTimestamp,
  updateBuildingOwnerFromOwnerCap,
  upsertBuildingInstance,
  upsertCharacterIdentity,
  upsertKillmailRecord,
} from './derived-records.mjs'

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
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
}

export function normalizePastObjectVersion(version) {
  if (version == null) {
    return null
  }

  const normalized = String(version).trim()

  if (!/^\d+$/.test(normalized)) {
    return null
  }

  const numericVersion = Number(normalized)

  if (!Number.isSafeInteger(numericVersion) || numericVersion < 0) {
    return null
  }

  return numericVersion
}

async function fetchSnapshotAtVersion(rpcPool, objectId, version, rpcUsage) {
  const pastObjectVersion = normalizePastObjectVersion(version)

  if (pastObjectVersion == null) {
    return null
  }

  try {
    const { result, rpcUrl } = await rpcPool.tryGetPastObject({
      id: objectId,
      version: pastObjectVersion,
      options: {
        showType: true,
        showOwner: true,
        showContent: true,
      },
    })

    rpcUsage.push(rpcUrl)

    return result
  } catch {
    return null
  }
}

export async function fetchBuildingSnapshot(rpcPool, packageId, change, rpcUsage) {
  const pastResult = await fetchSnapshotAtVersion(
    rpcPool,
    change.objectId,
    change.version,
    rpcUsage
  )

  if (pastResult) {
    const snapshot = extractBuildingInstanceSnapshot(pastResult, packageId)

    if (snapshot) {
      return snapshot
    }
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

async function fetchCurrentBuildingState(rpcPool, packageId, buildingObjectId, rpcUsage) {
  try {
    const { result, rpcUrl } = await rpcPool.getObject({
      id: buildingObjectId,
      options: {
        showType: true,
        showOwner: true,
        showContent: true,
      },
    })

    rpcUsage.push(rpcUrl)

    if (result?.error?.code === 'deleted' || result?.error?.object_id) {
      return {
        kind: 'deleted',
      }
    }

    const snapshot = extractBuildingInstanceSnapshot(result, packageId)

    if (!snapshot) {
      return {
        kind: 'unknown',
      }
    }

    return {
      kind: 'snapshot',
      snapshot,
    }
  } catch {
    return {
      kind: 'error',
    }
  }
}

export async function fetchCharacterIdentityFromChange(
  rpcPool,
  packageId,
  change,
  rpcUsage
) {
  const pastResult = await fetchSnapshotAtVersion(
    rpcPool,
    change.objectId,
    change.version,
    rpcUsage
  )

  if (pastResult) {
    const snapshot = extractCharacterIdentitySnapshot(pastResult, packageId)

    if (snapshot) {
      return snapshot
    }
  }

  try {
    const { result, rpcUrl } = await rpcPool.getObject({
      id: change.objectId,
      options: {
        showType: true,
        showOwner: true,
        showContent: true,
      },
    })

    rpcUsage.push(rpcUrl)

    return extractCharacterIdentitySnapshot(result, packageId)
  } catch {
    return null
  }
}

async function fetchCurrentCharacterIdentitySnapshot(
  rpcPool,
  packageId,
  characterObjectId,
  rpcUsage
) {
  if (!characterObjectId) {
    return null
  }

  try {
    const { result, rpcUrl } = await rpcPool.getObject({
      id: characterObjectId,
      options: {
        showType: true,
        showOwner: true,
        showContent: true,
      },
    })

    rpcUsage.push(rpcUrl)

    const snapshot = extractCharacterIdentitySnapshot(result, packageId)

    if (!snapshot) {
      return {
        kind: 'not_character',
        snapshot: null,
      }
    }

    return {
      kind: 'snapshot',
      snapshot,
    }
  } catch {
    return {
      kind: 'error',
      snapshot: null,
    }
  }
}

function buildCharacterIdentityResolutionSource(row, snapshot) {
  return {
    sourceTxDigest:
      row.last_seen_tx_digest ??
      `rpc:${snapshot.characterObjectId}:${snapshot.sourceObjectVersion}`,
    sourceTxTimestamp: row.last_seen_at ?? new Date(),
    sourceObjectVersion: snapshot.sourceObjectVersion,
  }
}

async function fetchOwnerCapOwnerCharacterObjectId(
  rpcPool,
  packageId,
  ownerCapId,
  rpcUsage
) {
  if (!ownerCapId) {
    return null
  }

  try {
    const { result, rpcUrl } = await rpcPool.getObject({
      id: ownerCapId,
      options: {
        showOwner: true,
      },
    })

    rpcUsage.push(rpcUrl)
    const details = result?.data ?? result
    const candidateId =
      details?.owner == null
        ? null
        : String(details.owner.ObjectOwner ?? details.owner.AddressOwner ?? '').trim()

    if (!candidateId) {
      return null
    }

    const ownerState = await fetchCurrentCharacterIdentitySnapshot(
      rpcPool,
      packageId,
      candidateId,
      rpcUsage
    )

    if (ownerState.kind !== 'snapshot') {
      return null
    }

    return ownerState.snapshot.characterObjectId
  } catch {
    return null
  }
}

async function fillPendingBuildingOwnerCharacterObjects(sql, rpcPool, packageId, limit) {
  if (!rpcPool) {
    return 0
  }

  const rows = await sql`
    SELECT
      id,
      owner_cap_id
    FROM building_instances
    WHERE owner_character_object_id IS NULL
    ORDER BY last_seen_at DESC, id DESC
    LIMIT ${limit}
  `

  let resolvedCount = 0

  for (const row of rows) {
    const ownerCharacterObjectId = await fetchOwnerCapOwnerCharacterObjectId(
      rpcPool,
      packageId,
      row.owner_cap_id,
      []
    )

    if (!ownerCharacterObjectId) {
      continue
    }

    const updatedRows = await sql`
      UPDATE building_instances
      SET
        owner_character_object_id = ${ownerCharacterObjectId},
        updated_at = NOW()
      WHERE id = ${row.id}
        AND owner_character_object_id IS NULL
      RETURNING id
    `

    if (updatedRows.length > 0) {
      resolvedCount += 1
    }
  }

  return resolvedCount
}

export async function resolvePendingBuildingInstances(
  sql,
  rpcPool,
  packageId,
  limit = 200
) {
  const resolvedOwnerCharacterObjectCount = await fillPendingBuildingOwnerCharacterObjects(
    sql,
    rpcPool,
    packageId,
    limit
  )
  const sqlItemResolution = await resolvePendingBuildingCharacterItems(sql, limit)
  let resolvedOwnerCharacterItemFromRpcCount = 0
  let resolvedCharacterIdentityCount = 0

  if (rpcPool) {
    const rows = await sql`
      WITH candidates AS (
        SELECT DISTINCT ON (bi.owner_character_object_id)
          bi.tenant,
          bi.owner_character_object_id,
          bi.last_seen_tx_digest,
          bi.last_seen_at,
          EXISTS (
            SELECT 1
            FROM character_identity AS ci
            WHERE ci.character_object_id = bi.owner_character_object_id
              AND ci.is_current = TRUE
          ) AS has_current_character_identity
        FROM building_instances AS bi
        WHERE bi.owner_character_object_id IS NOT NULL
          AND (
            bi.owner_character_item_id IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM character_identity AS ci
              WHERE ci.character_object_id = bi.owner_character_object_id
                AND ci.is_current = TRUE
            )
          )
        ORDER BY
          bi.owner_character_object_id ASC,
          bi.last_seen_at DESC,
          bi.id DESC
      )
      SELECT
        tenant,
        owner_character_object_id,
        last_seen_tx_digest,
        last_seen_at,
        has_current_character_identity
      FROM candidates
      ORDER BY last_seen_at DESC, owner_character_object_id ASC
      LIMIT ${limit}
    `

    for (const row of rows) {
      const snapshot = await fetchCurrentCharacterIdentitySnapshot(
        rpcPool,
        packageId,
        row.owner_character_object_id,
        []
      )

      if (snapshot.kind === 'not_character' && !row.has_current_character_identity) {
        await sql`
          UPDATE building_instances
          SET
            owner_character_object_id = NULL,
            owner_character_item_id = NULL,
            updated_at = NOW()
          WHERE tenant = ${row.tenant}
            AND owner_character_object_id = ${row.owner_character_object_id}
            AND NOT EXISTS (
              SELECT 1
              FROM character_identity AS ci
              WHERE ci.character_object_id = ${row.owner_character_object_id}
                AND ci.is_current = TRUE
            )
        `
        continue
      }

      if (snapshot.kind !== 'snapshot' || snapshot.snapshot.tenant !== row.tenant) {
        continue
      }

      if (!row.has_current_character_identity) {
        await upsertCharacterIdentity(
          sql,
          snapshot.snapshot,
          buildCharacterIdentityResolutionSource(row, snapshot.snapshot)
        )
        resolvedCharacterIdentityCount += 1
      }

      const updatedRows = await sql`
        UPDATE building_instances
        SET
          owner_character_item_id = ${snapshot.snapshot.characterItemId},
          updated_at = NOW()
        WHERE tenant = ${row.tenant}
          AND owner_character_object_id = ${row.owner_character_object_id}
          AND owner_character_item_id IS DISTINCT FROM ${snapshot.snapshot.characterItemId}
        RETURNING id
      `

      resolvedOwnerCharacterItemFromRpcCount += updatedRows.length
    }
  }

  return {
    resolvedCount:
      resolvedOwnerCharacterObjectCount +
      sqlItemResolution.resolvedCount +
      resolvedOwnerCharacterItemFromRpcCount +
      resolvedCharacterIdentityCount,
    resolvedOwnerCharacterObjectCount,
    resolvedOwnerCharacterItemCount:
      sqlItemResolution.resolvedCount + resolvedOwnerCharacterItemFromRpcCount,
    resolvedCharacterIdentityCount,
  }
}

export async function reconcileActiveBuildingInstances(
  sql,
  rpcPool,
  packageId,
  limit = 100,
  concurrency = 6
) {
  if (!rpcPool || limit <= 0) {
    return {
      checkedCount: 0,
      deactivatedCount: 0,
    }
  }

  const rows = await sql`
    SELECT
      id,
      building_object_id,
      status,
      is_active
    FROM building_instances
    WHERE is_active = TRUE
    ORDER BY last_reconciled_at ASC NULLS FIRST, id ASC
    LIMIT ${limit}
  `

  let checkedCount = 0
  let deactivatedCount = 0

  await runWithConcurrency(rows, concurrency, async (row) => {
    const state = await fetchCurrentBuildingState(
      rpcPool,
      packageId,
      row.building_object_id,
      []
    )

    checkedCount += 1

    if (state.kind === 'deleted') {
      await reconcileBuildingInstanceState(sql, {
        id: row.id,
        status: 'DELETED',
        isActive: false,
      })
      deactivatedCount += 1
      return
    }

    if (state.kind === 'snapshot' && state.snapshot.isActive !== row.is_active) {
      await reconcileBuildingInstanceState(sql, {
        id: row.id,
        status: state.snapshot.status,
        isActive: state.snapshot.isActive,
      })
      if (!state.snapshot.isActive) {
        deactivatedCount += 1
      }
      return
    }

    await markBuildingInstanceReconciled(sql, {
      id: row.id,
    })
  })

  return {
    checkedCount,
    deactivatedCount,
  }
}

export async function syncDerivedRecordsForTransactionBlock(
  sql,
  rpcPool,
  packageId,
  row
) {
  return sql.begin(async (transaction) =>
    syncDerivedRecordsForTransactionBlockInTransaction(transaction, rpcPool, packageId, row)
  )
}

export async function syncDerivedRecordsForTransactionBlockInTransaction(
  transaction,
  rpcPool,
  packageId,
  row
) {
  const sourceTxTimestamp = resolveSourceTimestamp(row)

  if (!sourceTxTimestamp) {
    throw new Error(`transaction ${row.digest} is missing a usable source timestamp`)
  }

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
  const createdCharacterSnapshotKeys = new Set(
    characterCreateSnapshots.map(
      (snapshot) => `${snapshot.characterObjectId}:${snapshot.sourceObjectVersion}`
    )
  )
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
    if (
      change.kind === 'upsert' &&
      !createdCharacterSnapshotKeys.has(`${change.objectId}:${change.version}`)
    ) {
      const snapshot = await fetchCharacterIdentityFromChange(
        rpcPool,
        packageId,
        change,
        rpcUsage
      )

      if (snapshot) {
        await upsertCharacterIdentity(transaction, snapshot, {
          sourceTxDigest: row.digest,
          sourceTxTimestamp,
          sourceObjectVersion: snapshot.sourceObjectVersion,
        })
      }

      continue
    }

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
    const ownerCharacterObjectId =
      ownerCapChange?.ownerCharacterObjectId ??
      (await fetchOwnerCapOwnerCharacterObjectId(
        rpcPool,
        packageId,
        snapshot.ownerCapId,
        rpcUsage
      ))

    await upsertBuildingInstance(transaction, snapshot, {
      sourceTxDigest: row.digest,
      sourceTxTimestamp,
      ownerCharacterObjectId,
    })
  }

  for (const ownerCapChange of buildingOwnerCapChanges) {
    const ownerCharacterObjectId =
      ownerCapChange.ownerCharacterObjectId ??
      (await fetchOwnerCapOwnerCharacterObjectId(
        rpcPool,
        packageId,
        ownerCapChange.ownerCapId,
        rpcUsage
      ))

    if (!ownerCharacterObjectId) {
      continue
    }

    await updateBuildingOwnerFromOwnerCap(transaction, {
      ownerCapId: ownerCapChange.ownerCapId,
      ownerCharacterObjectId,
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
}

export { resolvePendingKillmailRecords }
