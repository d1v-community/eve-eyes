import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { getIndexerConfig } from './config.mjs'
import {
  getModuleCursor,
  readState,
  writeModuleCursor,
} from './cursor-store.mjs'
import { upsertTransactionBlock } from './db.mjs'
import {
  buildTransactionBlockRecord,
  transactionBlockReferencesPackage,
} from './parser.mjs'
import {
  createSuiClient,
  fetchTransactionBlock,
  queryModuleEvents,
  resolvePackageModules,
} from './sui.mjs'
import { loadProjectEnv } from '../../frontend/scripts/load-env.mjs'
import { createSqlClient } from '../../frontend/src/app/server/db/client.mjs'
import { runPendingMigrations } from '../../frontend/src/app/server/db/migrations.mjs'

function createLogger(scope) {
  return {
    info(message, details) {
      if (details === undefined) {
        console.log(`[${scope}] ${message}`)
        return
      }

      console.log(`[${scope}] ${message}`, details)
    },
    error(message, error) {
      console.error(
        `[${scope}] ${message}`,
        error instanceof Error ? error.stack ?? error.message : error
      )
    },
  }
}

function createDigestCache(limit) {
  const seen = new Set()
  const order = []

  return {
    has(digest) {
      return seen.has(digest)
    },
    add(digest) {
      if (seen.has(digest)) {
        return
      }

      seen.add(digest)
      order.push(digest)

      while (order.length > limit) {
        const oldestDigest = order.shift()

        if (oldestDigest) {
          seen.delete(oldestDigest)
        }
      }
    },
    size() {
      return seen.size
    },
  }
}

async function bootstrapEnv(config) {
  await loadProjectEnv(config.repoRoot)
  await loadProjectEnv(config.frontendRoot)
}

function getMigrationsDirectory(config) {
  return path.join(config.frontendRoot, 'db', 'migrations')
}

async function processDigest(client, sql, config, digest, logger) {
  const txBlock = await fetchTransactionBlock(client, digest)

  if (!transactionBlockReferencesPackage(txBlock, config.packageId)) {
    return false
  }

  const record = buildTransactionBlockRecord(txBlock, config)
  await upsertTransactionBlock(sql, record, config, logger)

  return true
}

async function processModulePage({
  client,
  sql,
  config,
  state,
  logger,
  moduleName,
  digestCache,
}) {
  const cursor = getModuleCursor(state, moduleName)
  const page = await queryModuleEvents(client, config, moduleName, cursor)
  const events = page?.data ?? []

  if (events.length === 0) {
    return {
      state,
      processedTransactions: 0,
      nextPageFound: false,
    }
  }

  const pageDigests = [...new Set(events.map((event) => event?.id?.txDigest).filter(Boolean))]
  const digests = pageDigests.filter((digest) => !digestCache.has(digest))
  const skippedDigestCount = pageDigests.length - digests.length
  let processedTransactions = 0

  for (const digest of digests) {
    const stored = await processDigest(client, sql, config, digest, logger)

    digestCache.add(digest)

    if (stored) {
      processedTransactions += 1
    }
  }

  const lastEvent = events.at(-1)
  const nextCursor = page?.nextCursor ?? lastEvent?.id ?? null
  const nextState = await writeModuleCursor(config, state, moduleName, nextCursor)

  logger.info('processed event page', {
    moduleName,
    eventCount: events.length,
    candidateTransactionCount: pageDigests.length,
    skippedDigestCount,
    storedTransactionCount: processedTransactions,
    digestCacheSize: digestCache.size(),
  })

  return {
    state: nextState,
    processedTransactions,
    nextPageFound: Boolean(page?.hasNextPage),
  }
}

async function runPollingCycle({ client, sql, config, state, logger, modules }) {
  let nextState = state
  let totalProcessedTransactions = 0
  const digestCache = createDigestCache(config.digestCacheLimit)

  for (const moduleName of modules) {
    let keepPaging = true

    while (keepPaging) {
      const result = await processModulePage({
        client,
        sql,
        config,
        state: nextState,
        logger,
        moduleName,
        digestCache,
      })

      nextState = result.state
      totalProcessedTransactions += result.processedTransactions
      keepPaging = result.nextPageFound
    }
  }

  logger.info('completed polling cycle', {
    moduleCount: modules.length,
    storedTransactionCount: totalProcessedTransactions,
  })

  return nextState
}

async function main() {
  const config = getIndexerConfig()
  const logger = createLogger('indexer')

  await bootstrapEnv(config)

  const sql = createSqlClient()
  const client = createSuiClient(config)
  const modules = await resolvePackageModules(client, config)
  const migrationsDirectory = getMigrationsDirectory(config)

  logger.info('starting worker', {
    network: config.network,
    packageId: config.packageId,
    rpcUrl: config.rpcUrl,
    modules,
    stateFilePath: config.stateFilePath,
  })

  try {
    const appliedMigrations = await runPendingMigrations(sql, migrationsDirectory)

    if (appliedMigrations.length > 0) {
      logger.info('applied migrations', appliedMigrations)
    }

    let state = await readState(config)

    do {
      try {
        state = await runPollingCycle({
          client,
          sql,
          config,
          state,
          logger,
          modules,
        })
      } catch (error) {
        logger.error('polling cycle failed', error)

        if (!config.runOnce) {
          await delay(config.cycleErrorDelayMs)
        }
      }

      if (!config.runOnce) {
        await delay(config.pollIntervalMs)
      }
    } while (!config.runOnce)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(
    '[indexer] fatal error',
    error instanceof Error ? error.stack ?? error.message : error
  )
  process.exitCode = 1
})
