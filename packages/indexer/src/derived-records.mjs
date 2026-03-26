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

function normalizeCreatedReferences(effects) {
  return normalizeArray(effects?.created)
}

function normalizeTimestamp(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'string') {
    const normalized = value.trim()

    if (normalized.length === 0) {
      return null
    }

    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  return null
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

function getCharacterType(packageId) {
  return `${packageId}::character::Character`
}

function getCharacterCreatedEventType(packageId) {
  return `${packageId}::character::CharacterCreatedEvent`
}

function getKillmailEventType(packageId) {
  return `${packageId}::killmail::KillmailCreatedEvent`
}

const BUILDING_TYPE_NAMES_BY_MODULE = {
  assembly: 'Assembly',
  gate: 'Gate',
  network_node: 'NetworkNode',
  storage_unit: 'StorageUnit',
  turret: 'Turret',
}

function getBuildingObjectTypes(packageId) {
  return Object.fromEntries(
    Object.entries(BUILDING_TYPE_NAMES_BY_MODULE).map(([moduleName, typeName]) => [
      moduleName,
      `${packageId}::${moduleName}::${typeName}`,
    ])
  )
}

function getBuildingOwnerCapTypes(packageId) {
  return Object.fromEntries(
    Object.entries(getBuildingObjectTypes(packageId)).map(([moduleName, objectType]) => [
      moduleName,
      `${packageId}::access::OwnerCap<${objectType}>`,
    ])
  )
}

function findBuildingModuleNameByObjectType(objectType, packageId) {
  const normalizedObjectType = normalizeOptionalText(objectType)

  if (!normalizedObjectType) {
    return null
  }

  return (
    Object.entries(getBuildingObjectTypes(packageId)).find(
      ([, buildingObjectType]) => buildingObjectType === normalizedObjectType
    )?.[0] ?? null
  )
}

function getNestedVariant(value, depth = 4) {
  if (depth < 0 || value == null) {
    return null
  }

  if (typeof value?.variant === 'string' && value.variant.trim().length > 0) {
    return value.variant.trim()
  }

  const fields = value?.fields ?? value

  if (fields == null || typeof fields !== 'object') {
    return null
  }

  return getNestedVariant(fields.status ?? fields.value ?? null, depth - 1)
}

function isBuildingStatusActive(status) {
  return status !== 'DELETED' && status !== 'UNANCHORED'
}

function getLossTypeVariant(value) {
  if (typeof value?.variant === 'string' && value.variant.trim().length > 0) {
    return value.variant.trim()
  }

  return normalizeOptionalText(value)
}

export function resolveSourceTimestamp(row) {
  return (
    normalizeTimestamp(row?.transaction_time) ??
    normalizeTimestamp(row?.transactionTime) ??
    normalizeTimestamp(row?.created_at) ??
    normalizeTimestamp(row?.createdAt)
  )
}

export function unixSecondsToIso(value) {
  if (value == null) {
    return null
  }

  const normalized = String(value).trim()

  if (!normalized) {
    return null
  }

  let seconds

  try {
    seconds = BigInt(normalized)
  } catch {
    return null
  }

  const milliseconds = seconds * 1000n

  if (
    milliseconds > BigInt(Number.MAX_SAFE_INTEGER) ||
    milliseconds < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return null
  }

  const date = new Date(Number(milliseconds))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function extractCharacterObjectChanges(objectChanges, packageId) {
  const characterType = getCharacterType(packageId)

  return normalizeArray(objectChanges).flatMap((change) => {
    if (change?.objectType !== characterType) {
      return []
    }

    const objectId = normalizeOptionalText(change?.objectId)
    const version =
      change?.version == null
        ? normalizeOptionalText(change?.previousVersion)
        : String(change.version)

    if (!objectId) {
      return []
    }

    if ((change?.type === 'created' || change?.type === 'mutated') && version) {
      return [
        {
          kind: 'upsert',
          objectId,
          version,
        },
      ]
    }

    if (change?.type === 'deleted') {
      return [
        {
          kind: 'delete',
          objectId,
          version: version ?? null,
        },
      ]
    }

    return []
  })
}

export function extractCharacterCreatedSnapshots(events, objectChanges, effects, packageId) {
  const characterCreatedEventType = getCharacterCreatedEventType(packageId)
  const characterType = getCharacterType(packageId)
  const createdVersionByObjectId = new Map()

  for (const change of normalizeArray(objectChanges)) {
    if (change?.type !== 'created' || change?.objectType !== characterType) {
      continue
    }

    const objectId = normalizeOptionalText(change?.objectId)
    const version = change?.version == null ? null : String(change.version)

    if (!objectId || !version) {
      continue
    }

    createdVersionByObjectId.set(objectId, version)
  }

  for (const created of normalizeCreatedReferences(effects)) {
    const objectId = normalizeOptionalText(created?.reference?.objectId)
    const owner = created?.owner
    const version =
      created?.reference?.version == null
        ? null
        : String(created.reference.version)

    if (
      !objectId ||
      !version ||
      typeof owner !== 'object' ||
      owner == null ||
      !('Shared' in owner)
    ) {
      continue
    }

    if (!createdVersionByObjectId.has(objectId)) {
      createdVersionByObjectId.set(objectId, version)
    }
  }

  return normalizeArray(events).flatMap((event) => {
    if (event?.type !== characterCreatedEventType) {
      return []
    }

    const parsed = event?.parsedJson ?? {}
    const key = getTenantItemParts(parsed?.key)
    const characterObjectId = normalizeOptionalText(parsed?.character_id)
    const characterAddress = normalizeOptionalText(parsed?.character_address)
    const sourceObjectVersion =
      characterObjectId == null
        ? null
        : createdVersionByObjectId.get(characterObjectId) ?? null

    if (!key || !characterObjectId || !characterAddress || !sourceObjectVersion) {
      return []
    }

    return [
      {
        tenant: key.tenant,
        characterItemId: key.itemId,
        characterObjectId,
        characterAddress,
        sourceObjectVersion,
      },
    ]
  })
}

export function extractCharacterIdentitySnapshot(pastObject, packageId) {
  const details = pastObject?.details ?? pastObject?.data ?? pastObject
  const fields = details?.content?.fields ?? details?.fields

  if (details?.type !== getCharacterType(packageId) || !fields) {
    return null
  }

  const tenantItem = getTenantItemParts(fields?.key)
  const objectId = normalizeOptionalText(fields?.id?.id ?? details?.objectId)
  const characterAddress = normalizeOptionalText(fields?.character_address)
  const sourceObjectVersion =
    details?.version == null ? null : String(details.version)

  if (!tenantItem || !objectId || !characterAddress || !sourceObjectVersion) {
    return null
  }

  return {
    tenant: tenantItem.tenant,
    characterItemId: tenantItem.itemId,
    characterObjectId: objectId,
    characterAddress,
    sourceObjectVersion,
  }
}

export function extractBuildingObjectChanges(objectChanges, packageId) {
  return normalizeArray(objectChanges).flatMap((change) => {
    const moduleName = findBuildingModuleNameByObjectType(change?.objectType, packageId)

    if (!moduleName) {
      return []
    }

    const objectId = normalizeOptionalText(change?.objectId)
    const version =
      change?.version == null
        ? normalizeOptionalText(change?.previousVersion)
        : String(change.version)

    if (!objectId) {
      return []
    }

    if ((change?.type === 'created' || change?.type === 'mutated') && version) {
      return [
        {
          kind: 'upsert',
          moduleName,
          objectType: change.objectType,
          objectId,
          version,
        },
      ]
    }

    if (change?.type === 'deleted') {
      return [
        {
          kind: 'delete',
          moduleName,
          objectType: change.objectType,
          objectId,
          version: version ?? null,
        },
      ]
    }

    return []
  })
}

export function extractBuildingOwnerCapChanges(objectChanges, packageId) {
  const ownerCapTypes = getBuildingOwnerCapTypes(packageId)

  return normalizeArray(objectChanges).flatMap((change) => {
    const matchedEntry = Object.entries(ownerCapTypes).find(
      ([, ownerCapType]) => ownerCapType === change?.objectType
    )

    if (!matchedEntry) {
      return []
    }

    const [moduleName] = matchedEntry
    const ownerCapId = normalizeOptionalText(change?.objectId)
    const ownerCharacterObjectId = normalizeOptionalText(change?.owner?.AddressOwner)

    if (!ownerCapId) {
      return []
    }

    return [
      {
        moduleName,
        ownerCapId,
        ownerCharacterObjectId,
      },
    ]
  })
}

export function extractBuildingInstanceSnapshot(pastObject, packageId) {
  const details = pastObject?.details ?? pastObject?.data ?? pastObject
  const objectType = normalizeOptionalText(details?.type)
  const fields = details?.content?.fields ?? details?.fields
  const moduleName = findBuildingModuleNameByObjectType(objectType, packageId)

  if (!moduleName || !fields) {
    return null
  }

  const tenantItem = getTenantItemParts(fields?.key)
  const buildingObjectId = normalizeOptionalText(
    fields?.id?.id ?? details?.objectId ?? details?.data?.objectId
  )
  const typeId =
    fields?.type_id == null ? null : normalizeOptionalText(String(fields.type_id))
  const ownerCapId = normalizeOptionalText(fields?.owner_cap_id)
  const status = getNestedVariant(fields?.status)

  if (!tenantItem || !buildingObjectId || !typeId || !ownerCapId) {
    return null
  }

  return {
    tenant: tenantItem.tenant,
    buildingItemId: tenantItem.itemId,
    buildingObjectId,
    moduleName,
    objectType,
    typeId,
    ownerCapId,
    status,
    isActive: isBuildingStatusActive(status),
  }
}

export function extractKillmailEvents(events, packageId) {
  const killmailEventType = getKillmailEventType(packageId)

  return normalizeArray(events).flatMap((event) => {
    if (event?.type !== killmailEventType) {
      return []
    }

    const parsed = event?.parsedJson ?? {}
    const key = getTenantItemParts(parsed?.key)
    const killer = getTenantItemParts(parsed?.killer_id)
    const victim = getTenantItemParts(parsed?.victim_id)
    const reporter = getTenantItemParts(parsed?.reported_by_character_id)
    const solarSystem = getTenantItemParts(parsed?.solar_system_id)
    const eventSeq = normalizeOptionalText(event?.id?.eventSeq)
    const killTimestampUnix =
      parsed?.kill_timestamp == null ? null : String(parsed.kill_timestamp)
    const killTimestamp = unixSecondsToIso(killTimestampUnix)
    const lossType = getLossTypeVariant(parsed?.loss_type)

    if (
      !key ||
      !killer ||
      !victim ||
      !reporter ||
      !solarSystem ||
      !eventSeq ||
      !killTimestampUnix ||
      !killTimestamp ||
      !lossType
    ) {
      return []
    }

    return [
      {
        tenant: key.tenant,
        killmailItemId: key.itemId,
        killerCharacterItemId: killer.itemId,
        victimCharacterItemId: victim.itemId,
        reportedByCharacterItemId: reporter.itemId,
        solarSystemId: solarSystem.itemId,
        eventSeq,
        killTimestampUnix,
        killTimestamp,
        lossType,
        rawEvent: event,
      },
    ]
  })
}

export function buildResolutionError(payload) {
  const missing = []

  if (!payload?.killerWalletAddress) {
    missing.push('killer')
  }

  if (!payload?.victimWalletAddress) {
    missing.push('victim')
  }

  if (!payload?.reportedByWalletAddress) {
    missing.push('reported_by')
  }

  if (missing.length === 0) {
    return null
  }

  return `Missing character identity for ${missing.join(', ')}`
}

export async function closeCharacterIdentity(transaction, input) {
  await transaction`
    UPDATE character_identity
    SET
      valid_to = ${input.sourceTxTimestamp},
      is_current = FALSE,
      updated_at = NOW()
    WHERE character_object_id = ${input.characterObjectId}
      AND valid_from < ${input.sourceTxTimestamp}
      AND (valid_to IS NULL OR valid_to > ${input.sourceTxTimestamp})
  `

  await transaction`
    UPDATE character_identity
    SET
      is_current = TRUE,
      updated_at = NOW()
    WHERE id IN (
      SELECT ci.id
      FROM character_identity AS ci
      WHERE ci.character_object_id = ${input.characterObjectId}
        AND ci.valid_to IS NULL
      ORDER BY ci.valid_from DESC, ci.id DESC
      LIMIT 1
    )
  `
}

async function findNextCharacterIdentityRow(transaction, snapshot, source) {
  const rows = await transaction`
    SELECT
      id,
      valid_from
    FROM character_identity
    WHERE (
      character_object_id = ${snapshot.characterObjectId}
      OR (
        tenant = ${snapshot.tenant}
        AND character_item_id = ${snapshot.characterItemId}
      )
    )
      AND valid_from > ${source.sourceTxTimestamp}
    ORDER BY valid_from ASC, id ASC
    LIMIT 1
  `

  return rows[0] ?? null
}

async function refreshCurrentCharacterIdentityRows(transaction, snapshot) {
  await transaction`
    UPDATE character_identity
    SET
      is_current = FALSE,
      updated_at = NOW()
    WHERE is_current = TRUE
      AND (
        character_object_id = ${snapshot.characterObjectId}
        OR (
          tenant = ${snapshot.tenant}
          AND character_item_id = ${snapshot.characterItemId}
        )
      )
  `

  await transaction`
    UPDATE character_identity
    SET
      is_current = TRUE,
      updated_at = NOW()
    WHERE id IN (
      SELECT ci.id
      FROM character_identity AS ci
      WHERE (
        ci.character_object_id = ${snapshot.characterObjectId}
        OR (
          ci.tenant = ${snapshot.tenant}
          AND ci.character_item_id = ${snapshot.characterItemId}
        )
      )
        AND ci.valid_to IS NULL
      ORDER BY ci.valid_from DESC, ci.id DESC
      LIMIT 1
    )
  `
}

export async function upsertCharacterIdentity(transaction, snapshot, source) {
  const nextRow = await findNextCharacterIdentityRow(transaction, snapshot, source)

  await transaction`
    UPDATE character_identity
    SET
      valid_to = ${source.sourceTxTimestamp},
      is_current = FALSE,
      updated_at = NOW()
    WHERE (
      character_object_id = ${snapshot.characterObjectId}
      OR (
        tenant = ${snapshot.tenant}
        AND character_item_id = ${snapshot.characterItemId}
      )
    )
      AND valid_from < ${source.sourceTxTimestamp}
      AND (valid_to IS NULL OR valid_to > ${source.sourceTxTimestamp})
  `

  await transaction`
    INSERT INTO character_identity (
      tenant,
      character_item_id,
      character_object_id,
      character_address,
      source_tx_digest,
      source_tx_timestamp,
      source_object_version,
      valid_from,
      valid_to,
      is_current,
      updated_at
    )
    VALUES (
      ${snapshot.tenant},
      ${snapshot.characterItemId},
      ${snapshot.characterObjectId},
      ${snapshot.characterAddress},
      ${source.sourceTxDigest},
      ${source.sourceTxTimestamp},
      ${source.sourceObjectVersion},
      ${source.sourceTxTimestamp},
      ${nextRow?.valid_from ?? null},
      ${nextRow == null},
      NOW()
    )
    ON CONFLICT (character_object_id, source_object_version)
    DO UPDATE SET
      tenant = EXCLUDED.tenant,
      character_item_id = EXCLUDED.character_item_id,
      character_address = EXCLUDED.character_address,
      source_tx_digest = EXCLUDED.source_tx_digest,
      source_tx_timestamp = EXCLUDED.source_tx_timestamp,
      valid_from = EXCLUDED.valid_from,
      valid_to = EXCLUDED.valid_to,
      is_current = EXCLUDED.is_current,
      updated_at = NOW()
  `

  await refreshCurrentCharacterIdentityRows(transaction, snapshot)
}

async function findCurrentCharacterIdentityByObjectId(transaction, input) {
  if (!input?.ownerCharacterObjectId) {
    return null
  }

  const rows = await transaction`
    SELECT
      character_item_id,
      character_object_id
    FROM character_identity
    WHERE character_object_id = ${input.ownerCharacterObjectId}
      AND is_current = TRUE
    ORDER BY valid_from DESC, id DESC
    LIMIT 1
  `

  return rows[0] ?? null
}

export async function upsertBuildingInstance(transaction, snapshot, source) {
  const resolvedOwner = await findCurrentCharacterIdentityByObjectId(transaction, {
    ownerCharacterObjectId: source.ownerCharacterObjectId,
  })

  await transaction`
    INSERT INTO building_instances (
      tenant,
      building_item_id,
      building_object_id,
      module_name,
      object_type,
      type_id,
      owner_cap_id,
      owner_character_item_id,
      owner_character_object_id,
      status,
      is_active,
      first_seen_tx_digest,
      first_seen_at,
      last_seen_tx_digest,
      last_seen_at,
      updated_at
    )
    VALUES (
      ${snapshot.tenant},
      ${snapshot.buildingItemId},
      ${snapshot.buildingObjectId},
      ${snapshot.moduleName},
      ${snapshot.objectType},
      ${snapshot.typeId},
      ${snapshot.ownerCapId},
      ${resolvedOwner?.character_item_id ?? null},
      ${source.ownerCharacterObjectId ?? null},
      ${snapshot.status},
      ${snapshot.isActive},
      ${source.sourceTxDigest},
      ${source.sourceTxTimestamp},
      ${source.sourceTxDigest},
      ${source.sourceTxTimestamp},
      NOW()
    )
    ON CONFLICT (tenant, building_item_id)
    DO UPDATE SET
      building_object_id = CASE
        WHEN EXCLUDED.last_seen_at >= building_instances.last_seen_at
        THEN EXCLUDED.building_object_id
        ELSE building_instances.building_object_id
      END,
      module_name = CASE
        WHEN EXCLUDED.last_seen_at >= building_instances.last_seen_at
        THEN EXCLUDED.module_name
        ELSE building_instances.module_name
      END,
      object_type = CASE
        WHEN EXCLUDED.last_seen_at >= building_instances.last_seen_at
        THEN EXCLUDED.object_type
        ELSE building_instances.object_type
      END,
      type_id = CASE
        WHEN EXCLUDED.last_seen_at >= building_instances.last_seen_at
        THEN EXCLUDED.type_id
        ELSE building_instances.type_id
      END,
      owner_cap_id = CASE
        WHEN EXCLUDED.last_seen_at >= building_instances.last_seen_at
        THEN EXCLUDED.owner_cap_id
        ELSE building_instances.owner_cap_id
      END,
      owner_character_item_id = CASE
        WHEN EXCLUDED.last_seen_at >= building_instances.last_seen_at
          AND EXCLUDED.owner_character_item_id IS NOT NULL
        THEN EXCLUDED.owner_character_item_id
        ELSE building_instances.owner_character_item_id
      END,
      owner_character_object_id = CASE
        WHEN EXCLUDED.last_seen_at >= building_instances.last_seen_at
          AND EXCLUDED.owner_character_object_id IS NOT NULL
        THEN EXCLUDED.owner_character_object_id
        ELSE building_instances.owner_character_object_id
      END,
      status = CASE
        WHEN EXCLUDED.last_seen_at >= building_instances.last_seen_at
        THEN EXCLUDED.status
        ELSE building_instances.status
      END,
      is_active = CASE
        WHEN EXCLUDED.last_seen_at >= building_instances.last_seen_at
        THEN EXCLUDED.is_active
        ELSE building_instances.is_active
      END,
      first_seen_tx_digest = CASE
        WHEN EXCLUDED.first_seen_at < building_instances.first_seen_at
        THEN EXCLUDED.first_seen_tx_digest
        ELSE building_instances.first_seen_tx_digest
      END,
      first_seen_at = LEAST(building_instances.first_seen_at, EXCLUDED.first_seen_at),
      last_seen_tx_digest = CASE
        WHEN EXCLUDED.last_seen_at >= building_instances.last_seen_at
        THEN EXCLUDED.last_seen_tx_digest
        ELSE building_instances.last_seen_tx_digest
      END,
      last_seen_at = GREATEST(building_instances.last_seen_at, EXCLUDED.last_seen_at),
      updated_at = NOW()
  `
}

export async function closeBuildingInstance(transaction, input) {
  await transaction`
    UPDATE building_instances
    SET
      status = CASE
        WHEN ${input.sourceTxTimestamp} >= last_seen_at
        THEN 'DELETED'
        ELSE status
      END,
      is_active = CASE
        WHEN ${input.sourceTxTimestamp} >= last_seen_at
        THEN FALSE
        ELSE is_active
      END,
      last_seen_tx_digest = CASE
        WHEN ${input.sourceTxTimestamp} >= last_seen_at
        THEN ${input.sourceTxDigest}
        ELSE last_seen_tx_digest
      END,
      last_seen_at = GREATEST(last_seen_at, ${input.sourceTxTimestamp}),
      updated_at = NOW()
    WHERE building_object_id = ${input.buildingObjectId}
  `
}

export async function updateBuildingOwnerFromOwnerCap(transaction, input) {
  const resolvedOwner = await findCurrentCharacterIdentityByObjectId(transaction, {
    ownerCharacterObjectId: input.ownerCharacterObjectId,
  })

  await transaction`
    UPDATE building_instances
    SET
      owner_character_object_id = ${input.ownerCharacterObjectId ?? null},
      owner_character_item_id = ${resolvedOwner?.character_item_id ?? null},
      last_seen_tx_digest = CASE
        WHEN ${input.sourceTxTimestamp} >= last_seen_at
        THEN ${input.sourceTxDigest}
        ELSE last_seen_tx_digest
      END,
      last_seen_at = GREATEST(last_seen_at, ${input.sourceTxTimestamp}),
      updated_at = NOW()
    WHERE owner_cap_id = ${input.ownerCapId}
  `
}

export async function resolvePendingBuildingInstances(sql, limit = 200) {
  const rows = await sql`
    WITH candidates AS (
      SELECT
        bi.id,
        ci.character_item_id
      FROM building_instances AS bi
      JOIN character_identity AS ci
        ON ci.character_object_id = bi.owner_character_object_id
       AND ci.is_current = TRUE
      WHERE bi.owner_character_object_id IS NOT NULL
        AND bi.owner_character_item_id IS NULL
      ORDER BY bi.last_seen_at DESC, bi.id DESC
      LIMIT ${limit}
    ),
    updated AS (
      UPDATE building_instances AS bi
      SET
        owner_character_item_id = candidates.character_item_id,
        updated_at = NOW()
      FROM candidates
      WHERE bi.id = candidates.id
      RETURNING bi.id
    )
    SELECT COUNT(*)::int AS resolved_count
    FROM updated
  `

  return {
    resolvedCount: rows[0]?.resolved_count ?? 0,
  }
}

export async function upsertKillmailRecord(transaction, payload) {
  await transaction`
    INSERT INTO killmail_records (
      tenant,
      killmail_item_id,
      tx_digest,
      event_seq,
      tx_checkpoint,
      tx_timestamp,
      kill_timestamp,
      kill_timestamp_unix,
      loss_type,
      solar_system_id,
      killer_character_item_id,
      victim_character_item_id,
      reported_by_character_item_id,
      raw_event,
      updated_at
    )
    VALUES (
      ${payload.tenant},
      ${payload.killmailItemId},
      ${payload.txDigest},
      ${payload.eventSeq},
      ${payload.txCheckpoint},
      ${payload.txTimestamp},
      ${payload.killTimestamp},
      ${payload.killTimestampUnix},
      ${payload.lossType},
      ${payload.solarSystemId},
      ${payload.killerCharacterItemId},
      ${payload.victimCharacterItemId},
      ${payload.reportedByCharacterItemId},
      ${transaction.json(payload.rawEvent)},
      NOW()
    )
    ON CONFLICT (tx_digest, event_seq)
    DO UPDATE SET
      tenant = EXCLUDED.tenant,
      killmail_item_id = EXCLUDED.killmail_item_id,
      tx_checkpoint = EXCLUDED.tx_checkpoint,
      tx_timestamp = EXCLUDED.tx_timestamp,
      kill_timestamp = EXCLUDED.kill_timestamp,
      kill_timestamp_unix = EXCLUDED.kill_timestamp_unix,
      loss_type = EXCLUDED.loss_type,
      solar_system_id = EXCLUDED.solar_system_id,
      killer_character_item_id = EXCLUDED.killer_character_item_id,
      victim_character_item_id = EXCLUDED.victim_character_item_id,
      reported_by_character_item_id = EXCLUDED.reported_by_character_item_id,
      raw_event = EXCLUDED.raw_event,
      updated_at = NOW()
  `
}

export async function resolvePendingKillmailRecords(sql, limit = 200) {
  const rows = await sql`
    WITH candidates AS (
      SELECT
        kr.id,
        kr.tenant,
        kr.kill_timestamp,
        kr.killer_character_item_id,
        kr.victim_character_item_id,
        kr.reported_by_character_item_id
      FROM killmail_records AS kr
      WHERE kr.resolution_status = 'pending'
      ORDER BY kr.kill_timestamp ASC, kr.id ASC
      LIMIT ${limit}
    ),
    resolved AS (
      SELECT
        c.id,
        killer.character_address AS killer_wallet_address,
        victim.character_address AS victim_wallet_address,
        reporter.character_address AS reported_by_wallet_address
      FROM candidates AS c
      LEFT JOIN LATERAL (
        SELECT ci.character_address
        FROM character_identity AS ci
        WHERE ci.tenant = c.tenant
          AND ci.character_item_id = c.killer_character_item_id
          AND ci.valid_from <= c.kill_timestamp
          AND (ci.valid_to IS NULL OR ci.valid_to > c.kill_timestamp)
        ORDER BY ci.valid_from DESC, ci.id DESC
        LIMIT 1
      ) AS killer ON TRUE
      LEFT JOIN LATERAL (
        SELECT ci.character_address
        FROM character_identity AS ci
        WHERE ci.tenant = c.tenant
          AND ci.character_item_id = c.victim_character_item_id
          AND ci.valid_from <= c.kill_timestamp
          AND (ci.valid_to IS NULL OR ci.valid_to > c.kill_timestamp)
        ORDER BY ci.valid_from DESC, ci.id DESC
        LIMIT 1
      ) AS victim ON TRUE
      LEFT JOIN LATERAL (
        SELECT ci.character_address
        FROM character_identity AS ci
        WHERE ci.tenant = c.tenant
          AND ci.character_item_id = c.reported_by_character_item_id
          AND ci.valid_from <= c.kill_timestamp
          AND (ci.valid_to IS NULL OR ci.valid_to > c.kill_timestamp)
        ORDER BY ci.valid_from DESC, ci.id DESC
        LIMIT 1
      ) AS reporter ON TRUE
    ),
    updated AS (
      UPDATE killmail_records AS kr
      SET
        killer_wallet_address = resolved.killer_wallet_address,
        victim_wallet_address = resolved.victim_wallet_address,
        reported_by_wallet_address = resolved.reported_by_wallet_address,
        resolution_status = CASE
          WHEN resolved.killer_wallet_address IS NOT NULL
            AND resolved.victim_wallet_address IS NOT NULL
            AND resolved.reported_by_wallet_address IS NOT NULL
          THEN 'resolved'
          ELSE 'pending'
        END,
        resolution_error = CASE
          WHEN resolved.killer_wallet_address IS NOT NULL
            AND resolved.victim_wallet_address IS NOT NULL
            AND resolved.reported_by_wallet_address IS NOT NULL
          THEN NULL
          ELSE concat_ws(
            ', ',
            CASE
              WHEN resolved.killer_wallet_address IS NULL
              THEN 'missing killer identity'
              ELSE NULL
            END,
            CASE
              WHEN resolved.victim_wallet_address IS NULL
              THEN 'missing victim identity'
              ELSE NULL
            END,
            CASE
              WHEN resolved.reported_by_wallet_address IS NULL
              THEN 'missing reporter identity'
              ELSE NULL
            END
          )
        END,
        resolved_at = CASE
          WHEN resolved.killer_wallet_address IS NOT NULL
            AND resolved.victim_wallet_address IS NOT NULL
            AND resolved.reported_by_wallet_address IS NOT NULL
          THEN NOW()
          ELSE NULL
        END,
        updated_at = NOW()
      FROM resolved
      WHERE kr.id = resolved.id
      RETURNING kr.resolution_status
    )
    SELECT
      COUNT(*) FILTER (WHERE resolution_status = 'resolved')::int AS resolved_count,
      COUNT(*) FILTER (WHERE resolution_status = 'pending')::int AS pending_count
    FROM updated
  `

  return {
    resolvedCount: rows[0]?.resolved_count ?? 0,
    pendingCount: rows[0]?.pending_count ?? 0,
  }
}
