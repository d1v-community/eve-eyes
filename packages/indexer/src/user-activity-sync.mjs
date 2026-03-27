import {
  buildUserActivityRecordsForTransactionBlock,
  resolveUserActivityParticipants,
} from './user-activity-records.mjs'

function getRecordKey(record) {
  return [
    record.txDigest,
    record.eventSeq ?? '',
    record.callIndex ?? '',
    record.activityType,
    record.sourceKind,
  ].join(':')
}

async function insertActivityRecords(transaction, records) {
  if (records.length === 0) {
    return new Map()
  }

  const values = []
  const placeholders = records.map((record, index) => {
    const offset = index * 11
    values.push(
      record.tenant,
      record.txDigest,
      record.eventSeq,
      record.callIndex,
      record.activityTime,
      record.activityType,
      record.moduleName,
      record.functionName,
      record.sourceKind,
      record.summary,
      JSON.stringify(record.rawSource)
    )

    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}::jsonb)`
  })

  const rows = await transaction.unsafe(
    `
      INSERT INTO user_activity_records (
        tenant,
        tx_digest,
        event_seq,
        call_index,
        activity_time,
        activity_type,
        module_name,
        function_name,
        source_kind,
        summary,
        raw_source
      )
      VALUES ${placeholders.join(', ')}
      RETURNING
        id,
        tx_digest,
        event_seq,
        call_index,
        activity_type,
        source_kind
    `,
    values
  )

  const insertedIdsByKey = new Map()

  for (const row of rows) {
    insertedIdsByKey.set(
      [
        row.tx_digest,
        row.event_seq ?? '',
        row.call_index ?? '',
        row.activity_type,
        row.source_kind,
      ].join(':'),
      row.id ?? null
    )
  }

  return insertedIdsByKey
}

async function insertParticipants(transaction, rows) {
  if (rows.length === 0) {
    return
  }

  const values = []
  const placeholders = rows.map((participant, index) => {
    const offset = index * 7
    values.push(
      participant.activityRecordId,
      participant.role,
      participant.tenant,
      participant.characterItemId,
      participant.characterObjectId,
      participant.walletAddress,
      participant.resolvedVia
    )

    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
  })

  await transaction.unsafe(
    `
      INSERT INTO user_activity_participants (
        activity_record_id,
        role,
        tenant,
        character_item_id,
        character_object_id,
        wallet_address,
        resolved_via
      )
      VALUES ${placeholders.join(', ')}
    `,
    values
  )
}

export async function syncUserActivityRecordsForTransactionBlockInTransaction(
  transaction,
  packageId,
  row
) {
  if (!row?.digest) {
    throw new Error('transaction block row is missing digest')
  }

  await transaction`
    SELECT pg_advisory_xact_lock(hashtextextended(${row.digest}, 0))
  `

  const syncStateRows = await transaction`
    SELECT user_activity_synced_at
    FROM transaction_blocks
    WHERE digest = ${row.digest}
    LIMIT 1
  `

  if (syncStateRows[0]?.user_activity_synced_at) {
    return {
      skipped: true,
      activityCount: 0,
      participantCount: 0,
    }
  }

  const records = buildUserActivityRecordsForTransactionBlock(row, packageId)

  await transaction`
    DELETE FROM user_activity_records
    WHERE tx_digest = ${row.digest}
  `

  const insertedIdsByKey = await insertActivityRecords(transaction, records)
  const participantRows = []

  for (const record of records) {
    const activityRecordId = insertedIdsByKey.get(getRecordKey(record))

    if (!activityRecordId) {
      throw new Error(`activity record insert did not return id for ${getRecordKey(record)}`)
    }

    for (const participant of record.participants) {
      participantRows.push({
        activityRecordId,
        role: participant.role,
        tenant: participant.tenant,
        characterItemId: participant.characterItemId,
        characterObjectId: participant.characterObjectId,
        walletAddress: participant.walletAddress,
        resolvedVia: participant.resolvedVia,
      })
    }
  }

  await insertParticipants(transaction, participantRows)
  await resolveUserActivityParticipants(transaction, row.digest)

  await transaction`
    UPDATE transaction_blocks
    SET user_activity_synced_at = NOW()
    WHERE digest = ${row.digest}
  `

  return {
    skipped: false,
    activityCount: records.length,
    participantCount: participantRows.length,
  }
}

export async function syncUserActivityRecordsForTransactionBlock(
  sql,
  packageId,
  row
) {
  return sql.begin(async (transaction) =>
    syncUserActivityRecordsForTransactionBlockInTransaction(transaction, packageId, row)
  )
}
