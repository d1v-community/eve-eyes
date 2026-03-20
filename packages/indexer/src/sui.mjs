import { SuiClient } from '@mysten/sui/client'
import { setTimeout as delay } from 'node:timers/promises'

function normalizeModuleFilter(packageId, moduleName, key) {
  return {
    [key]: {
      package: packageId,
      module: moduleName,
    },
  }
}

function chunkArray(items, chunkSize) {
  const chunks = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
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

function annotateRpcError(error, context) {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error)
  const details = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')

  if (error instanceof Error) {
    error.message = details ? `${message} (${details})` : message
    error.rpcContext = context
    return error
  }

  const wrapped = new Error(details ? `${message} (${details})` : message)
  wrapped.rpcContext = context
  return wrapped
}

function getErrorStatus(error) {
  if (!error || typeof error !== 'object') {
    return null
  }

  if ('code' in error && typeof error.code === 'number') {
    return error.code
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status
  }

  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode
  }

  const message =
    'message' in error && typeof error.message === 'string' ? error.message : ''
  const match = message.match(/\bstatus code:\s*(\d{3})\b/i)

  return match ? Number.parseInt(match[1], 10) : null
}

function isRetryableRpcError(error) {
  const status = getErrorStatus(error)

  if (status === 429 || (status !== null && status >= 500)) {
    return true
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  return (
    message.includes('fetch failed') ||
    message.includes('timeout') ||
    message.includes('socket hang up') ||
    message.includes('ecconnreset') ||
    message.includes('temporarily unavailable')
  )
}

async function withRpcRetry(config, operation) {
  let attempt = 0
  let lastError

  while (attempt <= config.rpcRetryCount) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt === config.rpcRetryCount || !isRetryableRpcError(error)) {
        throw error
      }

      const delayMs = Math.min(
        config.rpcRetryDelayMs * 2 ** attempt,
        config.rpcRetryMaxDelayMs
      )

      await delay(delayMs)
      attempt += 1
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
      return await withRpcRetry(config, () =>
        queryEventsAscending(client, {
          query,
          cursor,
          limit: config.eventPageSize,
        })
      )
    } catch (error) {
      lastError = annotateRpcError(error, {
        rpcUrl: config.rpcUrl,
        operation: 'queryEvents',
        moduleName,
      })
    }
  }

  throw lastError
}

export async function getLatestModuleEventCursor(client, config, moduleName) {
  const filters = [
    normalizeModuleFilter(config.packageId, moduleName, 'MoveModule'),
    normalizeModuleFilter(config.packageId, moduleName, 'MoveEventModule'),
  ]

  let lastError

  for (const query of filters) {
    try {
      const page = await withRpcRetry(config, () =>
        client.queryEvents({
          query,
          limit: 1,
          order: 'descending',
        })
      )

      const latestEvent = page?.data?.[0]

      if (latestEvent?.id) {
        return latestEvent.id
      }
    } catch (error) {
      lastError = annotateRpcError(error, {
        rpcUrl: config.rpcUrl,
        operation: 'queryEventsLatestCursor',
        moduleName,
      })
    }
  }

  if (lastError) {
    throw lastError
  }

  return null
}

export async function fetchTransactionBlock(client, digest, config) {
  try {
    return await withRpcRetry(config, () =>
      client.getTransactionBlock({
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
    )
  } catch (error) {
    throw annotateRpcError(error, {
      rpcUrl: config.rpcUrl,
      operation: 'getTransactionBlock',
      digest,
    })
  }
}

export async function fetchTransactionBlocks(client, digests, config) {
  if (digests.length === 0) {
    return []
  }

  const results = []
  const digestChunks = chunkArray(digests, config.rpcBatchSize)

  for (const digestChunk of digestChunks) {
    try {
      const txBlocks = await withRpcRetry(config, () =>
        client.multiGetTransactionBlocks({
          digests: digestChunk,
          options: {
            showInput: true,
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
            showBalanceChanges: true,
            showRawInput: true,
          },
        })
      )

      results.push(...txBlocks)
      continue
    } catch (error) {
      if (digestChunk.length > 1) {
        const annotatedError = annotateRpcError(error, {
          rpcUrl: config.rpcUrl,
          operation: 'multiGetTransactionBlocks',
          batchSize: digestChunk.length,
        })

        console.error(
          '[indexer] batch transaction fetch failed, falling back to single fetches',
          annotatedError instanceof Error
            ? annotatedError.message
            : String(annotatedError)
        )
      } else {
        throw annotateRpcError(error, {
          rpcUrl: config.rpcUrl,
          operation: 'multiGetTransactionBlocks',
          batchSize: digestChunk.length,
        })
      }
    }

    for (const digest of digestChunk) {
      results.push(await fetchTransactionBlock(client, digest, config))
    }
  }

  return results
}
