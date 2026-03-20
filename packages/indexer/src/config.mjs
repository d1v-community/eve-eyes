import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getFullnodeUrl } from '@mysten/sui/client'

const DEFAULT_PACKAGE_ID =
  '0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')
const frontendRoot = path.join(repoRoot, 'packages', 'frontend')

function readInteger(name, fallback) {
  const value = process.env[name]

  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }

  return parsed
}

function normalizePackageId(packageId) {
  const normalized = packageId.trim().toLowerCase()

  if (!normalized.startsWith('0x') || normalized.length < 3) {
    throw new Error('SUI_INDEXER_PACKAGE_ID must be a valid package id')
  }

  return normalized
}

function readModules() {
  const value = process.env.SUI_INDEXER_MODULES?.trim()

  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function readInitialCursorMode() {
  const value = process.env.SUI_INDEXER_INITIAL_CURSOR_MODE?.trim().toLowerCase()

  if (!value) {
    return 'latest'
  }

  if (value !== 'latest' && value !== 'earliest') {
    throw new Error('SUI_INDEXER_INITIAL_CURSOR_MODE must be either "latest" or "earliest"')
  }

  return value
}

export function getIndexerConfig() {
  return {
    network: 'testnet',
    packageId: normalizePackageId(
      process.env.SUI_INDEXER_PACKAGE_ID ?? DEFAULT_PACKAGE_ID
    ),
    rpcUrl: process.env.SUI_INDEXER_RPC_URL ?? getFullnodeUrl('testnet'),
    pollIntervalMs: readInteger('SUI_INDEXER_POLL_INTERVAL_MS', 5000),
    eventPageSize: readInteger('SUI_INDEXER_EVENT_PAGE_SIZE', 50),
    dbRetryCount: readInteger('SUI_INDEXER_DB_RETRY_COUNT', 3),
    dbRetryDelayMs: readInteger('SUI_INDEXER_DB_RETRY_DELAY_MS', 1500),
    rpcRetryCount: readInteger('SUI_INDEXER_RPC_RETRY_COUNT', 5),
    rpcRetryDelayMs: readInteger('SUI_INDEXER_RPC_RETRY_DELAY_MS', 1000),
    rpcRetryMaxDelayMs: readInteger('SUI_INDEXER_RPC_RETRY_MAX_DELAY_MS', 15000),
    rpcBatchSize: readInteger('SUI_INDEXER_RPC_BATCH_SIZE', 20),
    processConcurrency: readInteger('SUI_INDEXER_PROCESS_CONCURRENCY', 4),
    cycleErrorDelayMs: readInteger('SUI_INDEXER_CYCLE_ERROR_DELAY_MS', 3000),
    digestCacheLimit: readInteger('SUI_INDEXER_DIGEST_CACHE_LIMIT', 5000),
    stateFilePath:
      process.env.SUI_INDEXER_STATE_FILE ??
      path.join(packageRoot, '.state', 'testnet-package-indexer.json'),
    runOnce: process.env.INDEXER_RUN_ONCE === 'true',
    configuredModules: readModules(),
    initialCursorMode: readInitialCursorMode(),
    repoRoot,
    frontendRoot,
    packageRoot,
  }
}
