import { SuiClient } from '@mysten/sui/client'

function normalizeModuleFilter(packageId, moduleName, key) {
  return {
    [key]: {
      package: packageId,
      module: moduleName,
    },
  }
}

async function queryEventsAscending(client, baseParams) {
  const attempts = [
    {
      ...baseParams,
      order: 'ascending',
    },
    {
      ...baseParams,
      descendingOrder: false,
    },
    baseParams,
  ]

  let lastError

  for (const params of attempts) {
    try {
      return await client.queryEvents(params)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

export function createSuiClient(config) {
  return new SuiClient({ url: config.rpcUrl })
}

export async function resolvePackageModules(client, config) {
  if (config.configuredModules.length > 0) {
    return config.configuredModules
  }

  if (typeof client.getNormalizedMoveModulesByPackage !== 'function') {
    throw new Error(
      'SUI_INDEXER_MODULES is required when getNormalizedMoveModulesByPackage is unavailable'
    )
  }

  const modules = await client.getNormalizedMoveModulesByPackage({
    package: config.packageId,
  })

  return Object.keys(modules).sort()
}

export async function queryModuleEvents(client, config, moduleName, cursor) {
  const filters = [
    normalizeModuleFilter(config.packageId, moduleName, 'MoveModule'),
    normalizeModuleFilter(config.packageId, moduleName, 'MoveEventModule'),
  ]

  let lastError

  for (const query of filters) {
    try {
      return await queryEventsAscending(client, {
        query,
        cursor,
        limit: config.eventPageSize,
      })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

export async function fetchTransactionBlock(client, digest) {
  return client.getTransactionBlock({
    digest,
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true,
      showRawInput: true,
    },
  })
}
