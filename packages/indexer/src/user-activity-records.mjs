import { extractMoveCalls } from '../scripts/sui-rpc-sync-helpers.mjs'
import { describeMoveCallRichAction } from '../../frontend/src/app/server/indexer/move-call-action.mjs'

function normalizeOptionalText(value) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

function normalizeObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : null
    } catch {
      return null
    }
  }

  return null
}

function normalizeTimestamp(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'string') {
    const normalized = value.trim()

    if (!normalized) {
      return null
    }

    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  return null
}

function unixSecondsToIso(value) {
  if (value == null) {
    return null
  }

  try {
    const seconds = BigInt(String(value).trim())
    const milliseconds = seconds * 1000n
    const date = new Date(Number(milliseconds))
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  } catch {
    return null
  }
}

function getEventTypeParts(type) {
  const normalized = normalizeOptionalText(type)

  if (!normalized) {
    return {
      moduleName: null,
      eventName: null,
    }
  }

  const parts = normalized.split('::')
  return {
    moduleName: parts.at(-2) ?? null,
    eventName: parts.at(-1) ?? null,
  }
}

function camelToSnake(value) {
  return String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

function getTenantItemParts(value) {
  const fields = value?.fields ?? value
  const tenant = normalizeOptionalText(fields?.tenant)
  const itemId = fields?.item_id == null ? null : String(fields.item_id)

  if (!tenant || !itemId) {
    return null
  }

  return {
    tenant,
    itemId,
  }
}

function isSuiAddress(value) {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{1,64}$/.test(value.trim())
}

function dedupeParticipants(participants) {
  const deduped = []
  const seen = new Set()

  for (const participant of participants) {
    if (!participant) {
      continue
    }

    const normalized = {
      role: normalizeOptionalText(participant.role) ?? 'participant',
      tenant: normalizeOptionalText(participant.tenant),
      characterItemId:
        participant.characterItemId == null ? null : String(participant.characterItemId),
      characterObjectId: normalizeOptionalText(participant.characterObjectId),
      walletAddress: isSuiAddress(participant.walletAddress)
        ? participant.walletAddress.trim().toLowerCase()
        : null,
      resolvedVia: normalizeOptionalText(participant.resolvedVia),
    }

    if (
      !normalized.characterItemId &&
      !normalized.characterObjectId &&
      !normalized.walletAddress
    ) {
      continue
    }

    const key = [
      normalized.role,
      normalized.tenant ?? '',
      normalized.characterItemId ?? '',
      normalized.characterObjectId ?? '',
      normalized.walletAddress ?? '',
    ].join(':')

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(normalized)
  }

  return deduped
}

function createRecord(input) {
  return {
    tenant: input.tenant ?? null,
    txDigest: input.txDigest,
    eventSeq: input.eventSeq ?? null,
    callIndex: input.callIndex ?? null,
    activityTime: input.activityTime,
    activityType: input.activityType,
    moduleName: input.moduleName ?? null,
    functionName: input.functionName ?? null,
    sourceKind: input.sourceKind,
    summary: input.summary,
    rawSource: input.rawSource,
    participants: dedupeParticipants(input.participants ?? []),
  }
}

function participantsFromActionEntities(entities) {
  return normalizeArray(entities).flatMap((entity) => {
    const value = normalizeOptionalText(entity?.value)
    const label = normalizeOptionalText(entity?.label)

    if (!value) {
      return []
    }

    if (entity?.kind === 'account' && isSuiAddress(value)) {
      return [
        {
          role: label ?? 'actor',
          walletAddress: value,
          resolvedVia: 'action_entity',
        },
      ]
    }

    if (entity?.kind === 'object' && label?.includes('character')) {
      return [
        {
          role: 'character',
          characterObjectId: value,
          resolvedVia: 'action_entity',
        },
      ]
    }

    if (entity?.kind === 'object') {
      return [
        {
          role: label ?? 'object',
          characterObjectId: value,
          resolvedVia: 'action_entity',
        },
      ]
    }

    return []
  })
}

function hasEventWithSuffix(events, suffix) {
  return normalizeArray(events).some(
    (event) => typeof event?.type === 'string' && event.type.endsWith(`::${suffix}`)
  )
}

function getEventActivityTime(event, fallbackTime) {
  const candidate = event?.timestampMs == null
    ? null
    : new Date(Number(event.timestampMs)).toISOString()

  return candidate ?? fallbackTime
}

function extractParticipantsFromGenericEvent(parsed) {
  const participants = []

  const characterObjectId = normalizeOptionalText(parsed?.character_id)
  const characterAddress = normalizeOptionalText(parsed?.character_address)
  const key = getTenantItemParts(parsed?.key)

  if (characterObjectId || characterAddress || key) {
    participants.push({
      role: 'actor',
      tenant: key?.tenant ?? null,
      characterItemId: key?.itemId ?? null,
      characterObjectId,
      walletAddress: characterAddress,
      resolvedVia: characterAddress ? 'event_wallet' : 'event_character',
    })
  }

  const roleMappings = [
    ['killer_id', 'killer'],
    ['victim_id', 'victim'],
    ['reported_by_character_id', 'reported_by'],
  ]

  for (const [field, role] of roleMappings) {
    const item = getTenantItemParts(parsed?.[field])

    if (!item) {
      continue
    }

    participants.push({
      role,
      tenant: item.tenant,
      characterItemId: item.itemId,
      resolvedVia: 'event_character_item',
    })
  }

  const objectRoleMappings = [
    ['source_gate_id', 'source_gate'],
    ['destination_gate_id', 'destination_gate'],
    ['assembly_id', 'assembly'],
  ]

  for (const [field, role] of objectRoleMappings) {
    const objectId = normalizeOptionalText(parsed?.[field])

    if (!objectId) {
      continue
    }

    participants.push({
      role,
      characterObjectId: objectId,
      resolvedVia: 'event_object',
    })
  }

  return participants
}

function addEventSenderParticipant(participants, event, role = 'sender') {
  const sender = normalizeOptionalText(event?.sender)

  if (!isSuiAddress(sender)) {
    return participants
  }

  participants.push({
    role,
    walletAddress: sender,
    resolvedVia: 'event_sender',
  })

  return participants
}

function extractEventActivity(event, txDigest, fallbackTime, packageId) {
  const normalizedType = normalizeOptionalText(event?.type)

  if (!normalizedType || !normalizedType.startsWith(`${packageId}::`)) {
    return null
  }

  const parsed = normalizeObject(event?.parsedJson) ?? {}
  const { moduleName, eventName } = getEventTypeParts(normalizedType)
  const eventSeq = normalizeOptionalText(event?.id?.eventSeq)
  const activityTime = getEventActivityTime(event, fallbackTime)

  if (!activityTime || !eventName) {
    return null
  }

  if (eventName === 'CharacterCreatedEvent') {
    const key = getTenantItemParts(parsed?.key)

    return createRecord({
      tenant: key?.tenant ?? null,
      txDigest,
      eventSeq,
      activityTime,
      activityType: 'character_created',
      moduleName,
      sourceKind: 'event',
      summary:
        `Character ${key?.itemId ?? 'unknown'} was created for wallet ` +
        `${normalizeOptionalText(parsed?.character_address) ?? 'unknown'}.`,
      rawSource: event,
      participants: addEventSenderParticipant([
        {
          role: 'actor',
          tenant: key?.tenant ?? null,
          characterItemId: key?.itemId ?? null,
          characterObjectId: normalizeOptionalText(parsed?.character_id),
          walletAddress: normalizeOptionalText(parsed?.character_address),
          resolvedVia: 'event_wallet',
        },
      ], event),
    })
  }

  if (eventName === 'KillmailCreatedEvent') {
    const key = getTenantItemParts(parsed?.key)
    const killTimestamp = unixSecondsToIso(parsed?.kill_timestamp)

    return createRecord({
      tenant: key?.tenant ?? null,
      txDigest,
      eventSeq,
      activityTime: killTimestamp ?? activityTime,
      activityType: 'killmail_created',
      moduleName,
      sourceKind: 'event',
      summary:
        `Killmail ${key?.itemId ?? 'unknown'} was created in solar system ` +
        `${getTenantItemParts(parsed?.solar_system_id)?.itemId ?? 'unknown'}.`,
      rawSource: event,
      participants: addEventSenderParticipant(extractParticipantsFromGenericEvent(parsed), event),
    })
  }

  if (eventName === 'JumpEvent') {
    return createRecord({
      tenant: null,
      txDigest,
      eventSeq,
      activityTime,
      activityType: 'jump',
      moduleName,
      sourceKind: 'event',
      summary:
        `Character ${normalizeOptionalText(parsed?.character_id) ?? 'unknown'} jumped from ` +
        `${normalizeOptionalText(parsed?.source_gate_id) ?? 'unknown'} to ` +
        `${normalizeOptionalText(parsed?.destination_gate_id) ?? 'unknown'}.`,
      rawSource: event,
      participants: addEventSenderParticipant([
        {
          role: 'actor',
          characterObjectId: normalizeOptionalText(parsed?.character_id),
          resolvedVia: 'event_character',
        },
        {
          role: 'source_gate',
          characterObjectId: normalizeOptionalText(parsed?.source_gate_id),
          resolvedVia: 'event_object',
        },
        {
          role: 'destination_gate',
          characterObjectId: normalizeOptionalText(parsed?.destination_gate_id),
          resolvedVia: 'event_object',
        },
      ], event),
    })
  }

  if (eventName === 'GateLinkedEvent') {
    return createRecord({
      tenant: null,
      txDigest,
      eventSeq,
      activityTime,
      activityType: 'gate_linked',
      moduleName,
      sourceKind: 'event',
      summary:
        `Gate ${normalizeOptionalText(parsed?.source_gate_id) ?? 'unknown'} linked to ` +
        `${normalizeOptionalText(parsed?.destination_gate_id) ?? 'unknown'}.`,
      rawSource: event,
      participants: addEventSenderParticipant(extractParticipantsFromGenericEvent(parsed), event),
    })
  }

  if (eventName === 'GateUnlinkedEvent') {
    return createRecord({
      tenant: null,
      txDigest,
      eventSeq,
      activityTime,
      activityType: 'gate_unlinked',
      moduleName,
      sourceKind: 'event',
      summary:
        `Gate ${normalizeOptionalText(parsed?.source_gate_id) ?? 'unknown'} unlinked from ` +
        `${normalizeOptionalText(parsed?.destination_gate_id) ?? 'unknown'}.`,
      rawSource: event,
      participants: addEventSenderParticipant(extractParticipantsFromGenericEvent(parsed), event),
    })
  }

  if (eventName === 'LocationRevealedEvent') {
    return createRecord({
      tenant: null,
      txDigest,
      eventSeq,
      activityTime,
      activityType: 'location_revealed',
      moduleName,
      sourceKind: 'event',
      summary:
        `Location was revealed for object ${normalizeOptionalText(parsed?.assembly_id) ?? 'unknown'}.`,
      rawSource: event,
      participants: addEventSenderParticipant(extractParticipantsFromGenericEvent(parsed), event),
    })
  }

  return createRecord({
    tenant: getTenantItemParts(parsed?.key)?.tenant ?? null,
    txDigest,
    eventSeq,
    activityTime,
    activityType: camelToSnake(eventName.replace(/Event$/, '')) || 'event_observed',
    moduleName,
    sourceKind: 'event',
    summary: `${moduleName ?? 'unknown'}::${eventName} was emitted.`,
    rawSource: event,
    participants: addEventSenderParticipant(extractParticipantsFromGenericEvent(parsed), event),
  })
}

function shouldSkipMoveCallActivity(functionName, events) {
  const mapping = new Map([
    ['create_character', 'CharacterCreatedEvent'],
    ['jump', 'JumpEvent'],
    ['jump_with_permit', 'JumpEvent'],
    ['link_gates', 'GateLinkedEvent'],
    ['unlink_gates', 'GateUnlinkedEvent'],
    ['reveal_location', 'LocationRevealedEvent'],
  ])

  const suffix = mapping.get(functionName)
  return suffix ? hasEventWithSuffix(events, suffix) : false
}

function extractMoveCallActivity(moveCall, rawContent, txDigest, fallbackTime, events) {
  if (shouldSkipMoveCallActivity(moveCall.functionName, events)) {
    return null
  }

  const action = describeMoveCallRichAction({
    moduleName: moveCall.moduleName,
    functionName: moveCall.functionName,
    rawCall: moveCall.rawCall,
    rawContent,
  })

  return createRecord({
    tenant: null,
    txDigest,
    callIndex: moveCall.callIndex,
    activityTime: fallbackTime,
    activityType: camelToSnake(moveCall.functionName) || 'move_call',
    moduleName: moveCall.moduleName,
    functionName: moveCall.functionName,
    sourceKind: 'move_call',
    summary: action.summary,
    rawSource: moveCall.rawCall,
    participants: participantsFromActionEntities(action.entities),
  })
}

export function buildUserActivityRecordsForTransactionBlock(row, packageId) {
  const txDigest = normalizeOptionalText(row?.digest)
  const activityTime =
    normalizeTimestamp(row?.transaction_time) ??
    normalizeTimestamp(row?.transactionTime) ??
    normalizeTimestamp(row?.created_at) ??
    normalizeTimestamp(row?.createdAt)
  const rawContent = normalizeObject(row?.raw_content) ?? normalizeObject(row?.rawContent) ?? null
  const events = normalizeArray(row?.events)

  if (!txDigest || !activityTime) {
    return []
  }

  const eventRecords = events
    .map((event) => extractEventActivity(event, txDigest, activityTime, packageId))
    .filter(Boolean)

  const moveCallRecords = rawContent == null
    ? []
    : extractMoveCalls(rawContent)
        .filter((moveCall) => normalizeOptionalText(moveCall.packageId) === packageId)
        .map((moveCall) =>
          extractMoveCallActivity(moveCall, rawContent, txDigest, activityTime, events)
        )
        .filter(Boolean)

  return [...eventRecords, ...moveCallRecords]
}

export async function resolveUserActivityParticipants(transaction, txDigest) {
  await transaction`
    WITH resolved AS (
      SELECT
        participant.id,
        (
          SELECT ci.character_address
          FROM character_identity AS ci
          WHERE (
            participant.character_object_id IS NOT NULL
            AND ci.character_object_id = participant.character_object_id
          ) OR (
            participant.character_object_id IS NULL
            AND participant.tenant IS NOT NULL
            AND participant.character_item_id IS NOT NULL
            AND ci.tenant = participant.tenant
            AND ci.character_item_id = participant.character_item_id
          )
            AND ci.valid_from <= activity.activity_time
            AND (ci.valid_to IS NULL OR ci.valid_to > activity.activity_time)
          ORDER BY ci.valid_from DESC, ci.id DESC
          LIMIT 1
        ) AS wallet_address
      FROM user_activity_participants AS participant
      JOIN user_activity_records AS activity
        ON activity.id = participant.activity_record_id
      WHERE activity.tx_digest = ${txDigest}
        AND participant.wallet_address IS NULL
    )
    UPDATE user_activity_participants AS participant
    SET
      wallet_address = resolved.wallet_address,
      resolved_via = CASE
        WHEN resolved.wallet_address IS NOT NULL
        THEN COALESCE(participant.resolved_via, 'character_identity')
        ELSE participant.resolved_via
      END,
      updated_at = NOW()
    FROM resolved
    WHERE participant.id = resolved.id
  `

  await transaction`
    WITH ranked_participants AS (
      SELECT
        activity.id AS activity_record_id,
        participant.wallet_address,
        participant.character_item_id,
        participant.character_object_id,
        ROW_NUMBER() OVER (
          PARTITION BY activity.id
          ORDER BY
            CASE participant.role
              WHEN 'actor' THEN 0
              WHEN 'killer' THEN 1
              WHEN 'victim' THEN 2
              WHEN 'reported_by' THEN 3
              ELSE 4
            END ASC,
            participant.id ASC
        ) AS row_number
      FROM user_activity_records AS activity
      LEFT JOIN user_activity_participants AS participant
        ON participant.activity_record_id = activity.id
      WHERE activity.tx_digest = ${txDigest}
    )
    UPDATE user_activity_records AS activity
    SET
      primary_wallet_address = ranked_participants.wallet_address,
      primary_character_item_id = ranked_participants.character_item_id,
      primary_character_object_id = ranked_participants.character_object_id,
      updated_at = NOW()
    FROM ranked_participants
    WHERE activity.id = ranked_participants.activity_record_id
      AND ranked_participants.row_number = 1
  `
}
