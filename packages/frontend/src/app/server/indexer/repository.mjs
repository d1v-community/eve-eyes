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

const PACKAGE_ID =
  '0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75'

export function listIndexerModules() {
  return INDEXER_MODULES
}

function buildEmptyModuleCallCounts() {
  return INDEXER_MODULES.map((moduleName) => ({
    moduleName,
    callCount: 0,
    latestTransactionTime: null,
  }))
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

  return INDEXER_MODULES.map((moduleName) => {
    const row = rowByModuleName.get(moduleName)

    return {
      moduleName,
      callCount: row?.callCount ?? 0,
      latestTransactionTime: row?.latestTransactionTime ?? null,
    }
  }).sort((left, right) => {
    if (right.callCount !== left.callCount) {
      return right.callCount - left.callCount
    }

    return left.moduleName.localeCompare(right.moduleName)
  })
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
