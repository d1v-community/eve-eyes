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
