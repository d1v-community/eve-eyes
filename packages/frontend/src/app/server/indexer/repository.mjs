const INDEXER_MODULES = [
  'access',
  'assembly',
  'character',
  'energy',
  'extension_freeze',
  'fuel',
  'gate',
  'in_game_id',
  'inventory',
  'killmail',
  'killmail_registry',
  'location',
  'metadata',
  'network_node',
  'object_registry',
  'sig_verify',
  'status',
  'storage_unit',
  'turret',
  'world',
]

import { resolveCharacterLabels } from './character-directory.mjs'

const MODULE_SPOTLIGHT_FUNCTIONS = {
  character: 'create_character',
}

const PACKAGE_ID =
  '0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75'

export function listIndexerModules() {
  return INDEXER_MODULES
}

function buildEmptyModuleCallCounts() {
  return []
}

function buildEmptyKillmailSummary() {
  return {
    totalRecords: 0,
    resolvedTotal: 0,
    pendingTotal: 0,
    latestKillAt: null,
  }
}

function isMissingRelationError(error) {
  return (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === '42P01'
  )
}

function isTransientConnectionError(error) {
  return (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ECONNRESET'
  )
}

export async function getModuleCallCounts(sql) {
  let rows
  let functionRows

  try {
    rows = await sql`
      SELECT
        module_name,
        COUNT(*)::int AS call_count,
        MAX(transaction_time) AS latest_transaction_time
      FROM suiscan_move_calls
      WHERE package_id = ${PACKAGE_ID}
      GROUP BY module_name
    `

    functionRows = await sql`
      SELECT
        module_name,
        function_name,
        COUNT(*)::int AS call_count
      FROM suiscan_move_calls
      WHERE package_id = ${PACKAGE_ID}
      GROUP BY module_name, function_name
    `
  } catch (error) {
    if (isMissingRelationError(error)) {
      return buildEmptyModuleCallCounts()
    }

    if (isTransientConnectionError(error)) {
      console.warn(
        'Failed to query suiscan_move_calls because the database connection was reset; returning empty module counts.'
      )
      return buildEmptyModuleCallCounts()
    }

    throw error
  }

  const rowByModuleName = new Map(
    rows.map((row) => [
      row.module_name,
      {
        callCount: row.call_count,
        latestTransactionTime: row.latest_transaction_time,
      },
    ])
  )

  const functionRowsByModuleName = new Map()

  for (const row of functionRows) {
    const moduleName = row.module_name
    const items = functionRowsByModuleName.get(moduleName) ?? []
    items.push({
      functionName: row.function_name,
      callCount: row.call_count,
    })
    functionRowsByModuleName.set(moduleName, items)
  }

  return INDEXER_MODULES.map((moduleName) => {
    const row = rowByModuleName.get(moduleName)
    const moduleFunctions = functionRowsByModuleName.get(moduleName) ?? []
    const spotlightFunctionName = MODULE_SPOTLIGHT_FUNCTIONS[moduleName] ?? null
    const spotlightFunction =
      spotlightFunctionName == null
        ? null
        : moduleFunctions.find(
            (moduleFunction) => moduleFunction.functionName === spotlightFunctionName
          ) ?? null
    const topFunction =
      moduleFunctions.length === 0
        ? null
        : [...moduleFunctions].sort((left, right) => {
            if (right.callCount !== left.callCount) {
              return right.callCount - left.callCount
            }

            return left.functionName.localeCompare(right.functionName)
          })[0]

    return {
      moduleName,
      callCount: row?.callCount ?? 0,
      latestTransactionTime: row?.latestTransactionTime ?? null,
      spotlightFunctionName:
        spotlightFunction?.functionName ?? topFunction?.functionName ?? null,
      spotlightFunctionCount:
        spotlightFunction?.callCount ?? topFunction?.callCount ?? 0,
    }
  })
    .filter((module) => module.callCount > 0)
    .sort((left, right) => {
    if (right.callCount !== left.callCount) {
      return right.callCount - left.callCount
    }

    return left.moduleName.localeCompare(right.moduleName)
  })
}

export async function getKillmailSummary(sql) {
  let rows

  try {
    rows = await sql`
      SELECT
        COUNT(*)::int AS total_records,
        COUNT(*) FILTER (WHERE resolution_status = 'resolved')::int AS resolved_total,
        COUNT(*) FILTER (WHERE resolution_status = 'pending')::int AS pending_total,
        MAX(kill_timestamp) AS latest_kill_at
      FROM killmail_records
    `
  } catch (error) {
    if (isMissingRelationError(error) || isTransientConnectionError(error)) {
      return buildEmptyKillmailSummary()
    }

    throw error
  }

  return {
    totalRecords: rows[0]?.total_records ?? 0,
    resolvedTotal: rows[0]?.resolved_total ?? 0,
    pendingTotal: rows[0]?.pending_total ?? 0,
    latestKillAt: rows[0]?.latest_kill_at ?? null,
  }
}

export async function listKillmailRecords(sql, input = {}) {
  const limit = Number.isInteger(input.limit) && input.limit > 0 ? input.limit : 40
  const status =
    typeof input.status === 'string' &&
    ['pending', 'resolved'].includes(input.status)
      ? input.status
      : null

  let rows

  try {
    rows = status
      ? await sql`
          SELECT
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
            killer_wallet_address,
            victim_wallet_address,
            reported_by_wallet_address,
            resolution_status,
            resolution_error,
            resolved_at,
            raw_event
          FROM killmail_records
          WHERE resolution_status = ${status}
          ORDER BY kill_timestamp DESC, id DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT
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
            killer_wallet_address,
            victim_wallet_address,
            reported_by_wallet_address,
            resolution_status,
            resolution_error,
            resolved_at,
            raw_event
          FROM killmail_records
          ORDER BY kill_timestamp DESC, id DESC
          LIMIT ${limit}
        `
  } catch (error) {
    if (isMissingRelationError(error) || isTransientConnectionError(error)) {
      return []
    }

    throw error
  }

  return rows.map((row) => ({
    tenant: row.tenant,
    killmailItemId: row.killmail_item_id,
    txDigest: row.tx_digest,
    eventSeq: row.event_seq,
    txCheckpoint: row.tx_checkpoint,
    txTimestamp: row.tx_timestamp,
    killTimestamp: row.kill_timestamp,
    killTimestampUnix: row.kill_timestamp_unix,
    lossType: row.loss_type,
    solarSystemId: row.solar_system_id,
    killerCharacterItemId: row.killer_character_item_id,
    victimCharacterItemId: row.victim_character_item_id,
    reportedByCharacterItemId: row.reported_by_character_item_id,
    killerWalletAddress: row.killer_wallet_address ?? null,
    victimWalletAddress: row.victim_wallet_address ?? null,
    reportedByWalletAddress: row.reported_by_wallet_address ?? null,
    resolutionStatus: row.resolution_status,
    resolutionError: row.resolution_error ?? null,
    resolvedAt: row.resolved_at ?? null,
    rawEvent: row.raw_event,
  }))
}

export async function listKillmailRecordsWithUsernames(sql, input = {}) {
  const records = await listKillmailRecords(sql, input)
  const { walletLabels, userIdLabels } = await resolveCharacterLabels(sql, {
    walletAddresses: records.flatMap((record) => [
      record.killerWalletAddress,
      record.victimWalletAddress,
      record.reportedByWalletAddress,
    ]),
    userIds: records.flatMap((record) => [
      record.killerCharacterItemId,
      record.victimCharacterItemId,
      record.reportedByCharacterItemId,
    ]),
  })

  return records.map((record) => ({
    ...record,
    killerUsername:
      (record.killerWalletAddress
        ? walletLabels.get(record.killerWalletAddress)
        : null) ?? userIdLabels.get(record.killerCharacterItemId) ?? null,
    victimUsername:
      (record.victimWalletAddress
        ? walletLabels.get(record.victimWalletAddress)
        : null) ?? userIdLabels.get(record.victimCharacterItemId) ?? null,
    reportedByUsername:
      (record.reportedByWalletAddress
        ? walletLabels.get(record.reportedByWalletAddress)
        : null) ?? userIdLabels.get(record.reportedByCharacterItemId) ?? null,
  }))
}

export async function listBuildingLeaderboard(sql, input = {}) {
  const limit = Number.isInteger(input.limit) && input.limit > 0 ? input.limit : 50
  const moduleName =
    typeof input.moduleName === 'string' && input.moduleName.trim().length > 0
      ? input.moduleName.trim()
      : null

  const rows = moduleName
    ? await sql`
        WITH grouped AS (
          SELECT
            bi.tenant,
            bi.owner_character_item_id,
            COUNT(*)::int AS building_count,
            MAX(bi.last_seen_at) AS last_seen_at
          FROM building_instances AS bi
          WHERE bi.is_active = TRUE
            AND bi.owner_character_item_id IS NOT NULL
            AND bi.module_name = ${moduleName}
          GROUP BY bi.tenant, bi.owner_character_item_id
        )
        SELECT
          grouped.tenant,
          grouped.owner_character_item_id,
          ci.character_address AS wallet_address,
          grouped.building_count,
          grouped.last_seen_at
        FROM grouped
        LEFT JOIN LATERAL (
          SELECT character_address
          FROM character_identity AS ci
          WHERE ci.tenant = grouped.tenant
            AND ci.character_item_id = grouped.owner_character_item_id
            AND ci.is_current = TRUE
          ORDER BY ci.valid_from DESC, ci.id DESC
          LIMIT 1
        ) AS ci ON TRUE
        ORDER BY
          grouped.building_count DESC,
          grouped.last_seen_at DESC NULLS LAST,
          COALESCE(ci.character_address, grouped.owner_character_item_id) ASC
        LIMIT ${limit}
      `
    : await sql`
        WITH grouped AS (
          SELECT
            bi.tenant,
            bi.owner_character_item_id,
            COUNT(*)::int AS building_count,
            MAX(bi.last_seen_at) AS last_seen_at
          FROM building_instances AS bi
          WHERE bi.is_active = TRUE
            AND bi.owner_character_item_id IS NOT NULL
          GROUP BY bi.tenant, bi.owner_character_item_id
        )
        SELECT
          grouped.tenant,
          grouped.owner_character_item_id,
          ci.character_address AS wallet_address,
          grouped.building_count,
          grouped.last_seen_at
        FROM grouped
        LEFT JOIN LATERAL (
          SELECT character_address
          FROM character_identity AS ci
          WHERE ci.tenant = grouped.tenant
            AND ci.character_item_id = grouped.owner_character_item_id
            AND ci.is_current = TRUE
          ORDER BY ci.valid_from DESC, ci.id DESC
          LIMIT 1
        ) AS ci ON TRUE
        ORDER BY
          grouped.building_count DESC,
          grouped.last_seen_at DESC NULLS LAST,
          COALESCE(ci.character_address, grouped.owner_character_item_id) ASC
        LIMIT ${limit}
      `

  return rows.map((row, index) => ({
    rank: index + 1,
    tenant: row.tenant,
    ownerCharacterItemId: row.owner_character_item_id,
    walletAddress: row.wallet_address ?? null,
    buildingCount: row.building_count,
    lastSeenAt: row.last_seen_at,
  }))
}

export async function getBuildingLeaderboardSummary(sql, input = {}) {
  const moduleName =
    typeof input.moduleName === 'string' && input.moduleName.trim().length > 0
      ? input.moduleName.trim()
      : null

  const rows = moduleName
    ? await sql`
        SELECT
          COUNT(*)::int AS active_building_total,
          COUNT(DISTINCT (tenant, owner_character_item_id))::int AS ranked_owner_total,
          MAX(last_seen_at) AS latest_seen_at
        FROM building_instances
        WHERE is_active = TRUE
          AND owner_character_item_id IS NOT NULL
          AND module_name = ${moduleName}
      `
    : await sql`
        SELECT
          COUNT(*)::int AS active_building_total,
          COUNT(DISTINCT (tenant, owner_character_item_id))::int AS ranked_owner_total,
          MAX(last_seen_at) AS latest_seen_at
        FROM building_instances
        WHERE is_active = TRUE
          AND owner_character_item_id IS NOT NULL
      `

  return {
    activeBuildingTotal: rows[0]?.active_building_total ?? 0,
    rankedOwnerTotal: rows[0]?.ranked_owner_total ?? 0,
    latestSeenAt: rows[0]?.latest_seen_at ?? null,
  }
}
