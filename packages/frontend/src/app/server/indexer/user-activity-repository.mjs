import { normalizeWalletAddress } from '../users/repository.mjs'

function normalizeOptionalText(value) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeOptionalInteger(value, label, { allowZero = false } = {}) {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = String(value).trim()

  if (!normalized) {
    return null
  }

  const parsed = Number.parseInt(normalized, 10)

  if (Number.isNaN(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) {
    throw new Error(
      `${label} must be a ${allowZero ? 'non-negative' : 'positive'} integer`
    )
  }

  return parsed
}

function normalizeOptionalTimestamp(value, label) {
  const normalized = normalizeOptionalText(value)

  if (!normalized) {
    return null
  }

  const date = new Date(normalized)

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid timestamp`)
  }

  return date.toISOString()
}

export function parseUserActivityFilters(searchParams) {
  return {
    address: normalizeOptionalText(searchParams.get('address')),
    walletAddress: normalizeOptionalText(searchParams.get('walletAddress')),
    objectId: normalizeOptionalText(searchParams.get('objectId')),
    tenant: normalizeOptionalText(searchParams.get('tenant')),
    activityType: normalizeOptionalText(searchParams.get('activityType')),
    moduleName: normalizeOptionalText(searchParams.get('moduleName')),
    functionName: normalizeOptionalText(searchParams.get('functionName')),
    sourceKind: normalizeOptionalText(searchParams.get('sourceKind')),
    txDigest: normalizeOptionalText(searchParams.get('txDigest')),
    eventSeq: normalizeOptionalText(searchParams.get('eventSeq')),
    callIndex: normalizeOptionalInteger(searchParams.get('callIndex'), 'callIndex', {
      allowZero: true,
    }),
    from: normalizeOptionalTimestamp(searchParams.get('from'), 'from'),
    to: normalizeOptionalTimestamp(searchParams.get('to'), 'to'),
  }
}

function mapParticipantRow(row) {
  return {
    id: String(row.id),
    role: row.role,
    tenant: row.tenant,
    characterItemId: row.character_item_id,
    characterObjectId: row.character_object_id,
    walletAddress: row.wallet_address,
    resolvedVia: row.resolved_via,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapActivityRow(row, participants = []) {
  return {
    id: String(row.id),
    tenant: row.tenant,
    txDigest: row.tx_digest,
    eventSeq: row.event_seq,
    callIndex: row.call_index,
    activityTime: row.activity_time,
    activityType: row.activity_type,
    moduleName: row.module_name,
    functionName: row.function_name,
    sourceKind: row.source_kind,
    summary: row.summary,
    walletAddress: row.primary_wallet_address,
    characterItemId: row.primary_character_item_id,
    characterObjectId: row.primary_character_object_id,
    rawSource: row.raw_source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    participants,
  }
}

export async function listUserActivities(sql, input) {
  const filters = input.filters
  const conditions = []
  const params = []

  const push = (condition, ...values) => {
    let nextCondition = condition

    for (const value of values) {
      params.push(value)
      nextCondition = nextCondition.replace('?', `$${params.length}`)
    }

    conditions.push(nextCondition)
  }

  if (filters.address) {
    const normalizedAddress = normalizeWalletAddress(filters.address)

    push(
      `EXISTS (
        SELECT 1
        FROM user_activity_participants AS participant
        WHERE participant.activity_record_id = record.id
          AND (
            participant.wallet_address = ?
            OR participant.character_object_id = ?
          )
      )`,
      normalizedAddress,
      normalizedAddress
    )
  }
  if (filters.walletAddress) {
    push(
      `EXISTS (
        SELECT 1
        FROM user_activity_participants AS participant
        WHERE participant.activity_record_id = record.id
          AND participant.wallet_address = ?
      )`,
      normalizeWalletAddress(filters.walletAddress)
    )
  }
  if (filters.objectId) {
    push(
      `EXISTS (
        SELECT 1
        FROM user_activity_participants AS participant
        WHERE participant.activity_record_id = record.id
          AND participant.character_object_id = ?
      )`,
      normalizeWalletAddress(filters.objectId)
    )
  }
  if (filters.tenant) {
    push('record.tenant = ?', filters.tenant)
  }
  if (filters.activityType) {
    push('record.activity_type = ?', filters.activityType)
  }
  if (filters.moduleName) {
    push('record.module_name = ?', filters.moduleName)
  }
  if (filters.functionName) {
    push('record.function_name = ?', filters.functionName)
  }
  if (filters.sourceKind) {
    push('record.source_kind = ?', filters.sourceKind)
  }
  if (filters.txDigest) {
    push('record.tx_digest = ?', filters.txDigest)
  }
  if (filters.eventSeq) {
    push('record.event_seq = ?', filters.eventSeq)
  }
  if (filters.callIndex != null) {
    push('record.call_index = ?', filters.callIndex)
  }
  if (filters.from) {
    push('record.activity_time >= ?', filters.from)
  }
  if (filters.to) {
    push('record.activity_time <= ?', filters.to)
  }

  const whereText = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const listRows = await sql.unsafe(
    `
      SELECT
        record.id,
        record.tenant,
        record.tx_digest,
        record.event_seq,
        record.call_index,
        record.activity_time,
        record.activity_type,
        record.module_name,
        record.function_name,
        record.source_kind,
        record.summary,
        record.primary_wallet_address,
        record.primary_character_item_id,
        record.primary_character_object_id,
        record.raw_source,
        record.created_at,
        record.updated_at
      FROM user_activity_records AS record
      ${whereText}
      ORDER BY record.activity_time DESC, record.id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, input.pageSize, input.offset]
  )

  const countRows = await sql.unsafe(
    `
      SELECT COUNT(*)::int AS total
      FROM user_activity_records AS record
      ${whereText}
    `,
    params
  )

  const recordIds = listRows.map((row) => Number(row.id))
  const participantRows = recordIds.length === 0
    ? []
    : await sql.unsafe(
      `
        SELECT
          id,
          activity_record_id,
          role,
          tenant,
          character_item_id,
          character_object_id,
          wallet_address,
          resolved_via,
          created_at,
          updated_at
        FROM user_activity_participants
        WHERE activity_record_id IN (${recordIds
          .map((_, index) => `$${index + 1}`)
          .join(', ')})
        ORDER BY activity_record_id ASC, id ASC
      `,
      recordIds
    )

  const participantsByRecordId = new Map()

  for (const row of participantRows) {
    const key = String(row.activity_record_id)
    const items = participantsByRecordId.get(key) ?? []
    items.push(mapParticipantRow(row))
    participantsByRecordId.set(key, items)
  }

  return {
    items: listRows.map((row) =>
      mapActivityRow(row, participantsByRecordId.get(String(row.id)) ?? [])
    ),
    total: countRows[0]?.total ?? 0,
  }
}
