import { setTimeout as delay } from 'node:timers/promises'
import { getIndexerConfig } from './config.mjs'
import {
  createSuiClient,
  fetchTransactionBlock,
  getLatestModuleEventCursor,
  queryModuleEvents,
  resolvePackageModules,
} from './sui.mjs'
import { getModuleCursor, readState, writeModuleCursor } from './cursor-store.mjs'
import {
  bootstrapIndexerEnv,
  getMigrationsDirectory,
  processTransactionBlock,
} from './ingest.mjs'
import { createLogger } from './logger.mjs'
import { resolvePendingKillmailRecords } from './derived-record-sync.mjs'
import { createSqlClient } from '../../frontend/src/app/server/db/client.mjs'
import { runPendingMigrations } from '../../frontend/src/app/server/db/migrations.mjs'
import { createRpcPool } from '../scripts/sui-rpc-sync-helpers.mjs'

function getRealtimeDigest(message) {
  return message?.transactionDigest ?? message?.digest ?? message?.id?.txDigest ?? null
}

function getWebhookUrl() {
  return process.env.notify_webhook?.trim() || process.env.NOTIFY_WEBHOOK?.trim() || null
}

function getTransactionUrl(digest) {
  return `https://testnet.suivision.xyz/txblock/${digest}`
}

async function sendWebhookNotification(webhookUrl, config, result, logger) {
  if (!webhookUrl || !result?.stored || !result?.digest) {
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        msg_type: 'text',
        content: {
          text: [
            '[eve-eyes] New package transaction detected',
            `package: ${config.packageId}`,
            `digest: ${result.digest}`,
            `txblock: ${getTransactionUrl(result.digest)}`,
            `transaction_time: ${result.transactionTime ?? 'unknown'}`,
          ].join('\n'),
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Webhook request failed with status ${response.status}`)
    }

    logger.info('sent webhook notification', {
      digest: result.digest,
      transactionTime: result.transactionTime,
    })
  } catch (error) {
    logger.error('webhook notification failed', error)
  } finally {
    clearTimeout(timeout)
  }
}

async function processDigest(sql, client, config, logger, digest, rpcPool) {
  const txBlock = await fetchTransactionBlock(client, digest, config)
  const result = await processTransactionBlock(sql, config, txBlock, logger, {
    rpcPool,
    syncDerivedRecords: true,
    syncUserActivities: true,
  })

  logger.info('processed transaction', {
    digest: result.digest,
    stored: result.stored,
    checkpoint: result.checkpoint,
    executedAt: result.executedAt,
    derivedSynced: result.derivedSynced,
    characterChangeCount: result.characterChangeCount,
    killmailCount: result.killmailCount,
    activitySynced: result.activitySynced,
    activityCount: result.activityCount,
  })

  return result
}

<<<<<<< HEAD
async function bootstrapCompensationCursors(client, config, logger, modules) {
  let state = await readState(config)
=======
async function runPollingFallback(sql, client, config, logger, modules, seenDigests, webhookUrl, rpcPool) {
>>>>>>> b31d6d1 (feat: Implement user activity syncing, indexing, and display across the frontend and indexer.)
  const moduleCursors = new Map()

  for (const moduleName of modules) {
    let cursor = getModuleCursor(state, moduleName)

    if (cursor == null && config.initialCursorMode === 'latest') {
      cursor = await getLatestModuleEventCursor(client, config, moduleName)
      state = await writeModuleCursor(config, state, moduleName, cursor)
    }

    moduleCursors.set(moduleName, cursor)

    logger.info('bootstrapped compensation cursor', {
      moduleName,
      cursor,
      source: getModuleCursor(state, moduleName) ? 'state' : config.initialCursorMode,
    })
  }

  return {
    state,
    moduleCursors,
  }
}

async function runCompensationPolling(
  sql,
  client,
  config,
  logger,
  modules,
  seenDigests,
  inflightDigests,
  webhookUrl,
  shouldStop
) {
  const bootstrap = await bootstrapCompensationCursors(client, config, logger, modules)
  let state = bootstrap.state
  const moduleCursors = bootstrap.moduleCursors

  logger.info('starting compensation polling', {
    moduleCount: modules.length,
    pollIntervalMs: config.compensationPollIntervalMs,
    stateFilePath: config.stateFilePath,
    initialCursorMode: config.initialCursorMode,
  })

  while (!shouldStop()) {
    let storedTransactionCount = 0

    for (const moduleName of modules) {
      while (!shouldStop()) {
        const cursor = moduleCursors.get(moduleName) ?? null
        let page

        try {
          page = await queryModuleEvents(client, config, moduleName, cursor)
        } catch (error) {
          logger.error(`compensation polling failed for module ${moduleName}`, error)
          break
        }

        const events = page?.data ?? []

        if (events.length === 0) {
          break
        }

        const pageDigests = [
          ...new Set(events.map((event) => event?.id?.txDigest).filter(Boolean)),
        ]
        let pageStoredTransactionCount = 0

<<<<<<< HEAD
        for (const digest of pageDigests) {
          if (!digest || inflightDigests.has(digest) || seenDigests.has(digest)) {
            continue
          }

          inflightDigests.add(digest)

          try {
            seenDigests.add(digest)
            const result = await processDigest(sql, client, config, logger, digest)
            await sendWebhookNotification(webhookUrl, config, result, logger)

            if (result.stored) {
              storedTransactionCount += 1
              pageStoredTransactionCount += 1
            }
          } catch (error) {
            logger.error('failed to process compensation transaction', error)
            seenDigests.delete(digest)
          } finally {
            inflightDigests.delete(digest)
          }
=======
        for (const digest of digests) {
          seenDigests.add(digest)
          const result = await processDigest(sql, client, config, logger, digest, rpcPool)
          if (result.derivedSynced && (result.characterChangeCount > 0 || result.killmailCount > 0)) {
            await resolvePendingKillmailRecords(sql, 100)
          }
          await sendWebhookNotification(webhookUrl, config, result, logger)
          storedTransactionCount += 1
>>>>>>> b31d6d1 (feat: Implement user activity syncing, indexing, and display across the frontend and indexer.)
        }

        const lastEvent = events.at(-1)
        const nextCursor = page?.nextCursor ?? lastEvent?.id ?? cursor

        moduleCursors.set(moduleName, nextCursor)
        state = await writeModuleCursor(config, state, moduleName, nextCursor)

        logger.info('processed compensation event page', {
          moduleName,
          eventCount: events.length,
          candidateTransactionCount: pageDigests.length,
          storedTransactionCount: pageStoredTransactionCount,
          latestEventDigest: lastEvent?.id?.txDigest ?? null,
          latestEventSequence: lastEvent?.id?.eventSeq ?? null,
          nextCursor,
        })

        if (!page?.hasNextPage) {
          break
        }
      }
    }

    logger.info('completed compensation cycle', {
      moduleCount: modules.length,
      storedTransactionCount,
    })

    if (shouldStop()) {
      break
    }

    await delay(config.compensationPollIntervalMs)
  }
}

async function main() {
  const config = getIndexerConfig()
  const logger = createLogger('indexer')
  const webhookUrl = getWebhookUrl()

  await bootstrapIndexerEnv(config)

  const sql = createSqlClient()
  const client = createSuiClient(config)
  const rpcPool = createRpcPool()
  const modules = await resolvePackageModules(client, config)
  const migrationsDirectory = getMigrationsDirectory(config)
  const inflightDigests = new Set()
  const seenDigests = new Set()
  let unsubscribe = null
  let shuttingDown = false

  async function shutdown(signal) {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    logger.info('received shutdown signal', { signal })

    if (unsubscribe) {
      try {
        await unsubscribe()
      } catch (error) {
        logger.error('failed to unsubscribe transaction listener', error)
      }
    }

    await sql.end({ timeout: 5 })
    process.exit(0)
  }

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((error) => {
      logger.error('shutdown failed', error)
      process.exit(1)
    })
  })

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((error) => {
      logger.error('shutdown failed', error)
      process.exit(1)
    })
  })

  try {
    const appliedMigrations = await runPendingMigrations(sql, migrationsDirectory)

    if (appliedMigrations.length > 0) {
      logger.info('applied migrations', appliedMigrations)
    }

    logger.info('starting worker', {
      network: config.network,
      packageId: config.packageId,
      rpcUrl: config.rpcUrl,
      modules,
      webhookEnabled: Boolean(webhookUrl),
    })
    const compensationPollingPromise = runCompensationPolling(
      sql,
      client,
      config,
      logger,
      modules,
      seenDigests,
      inflightDigests,
      webhookUrl,
      () => shuttingDown
    ).catch((error) => {
      if (!shuttingDown) {
        logger.error('compensation polling failed', error)
      }
    })

    try {
      unsubscribe = await Promise.race([
        client.subscribeTransaction({
          filter: {
            MoveFunction: {
              package: config.packageId,
            },
          },
          onMessage: (message) => {
            const digest = getRealtimeDigest(message)

            if (!digest || inflightDigests.has(digest) || seenDigests.has(digest)) {
              return
            }

            inflightDigests.add(digest)

            ;(async () => {
              try {
                seenDigests.add(digest)
                const result = await processDigest(sql, client, config, logger, digest)
                await sendWebhookNotification(webhookUrl, config, result, logger)
              } catch (error) {
                logger.error('failed to process realtime transaction', error)
                seenDigests.delete(digest)
              } finally {
                inflightDigests.delete(digest)
              }
            })().catch((error) => {
              logger.error('unexpected realtime task failure', error)
              inflightDigests.delete(digest)
            })
          },
        }),
        delay(10000).then(() => {
          throw new Error('transaction subscription setup timed out after 10000ms')
        }),
      ])

      logger.info('subscribed to package transactions', {
        packageId: config.packageId,
      })

      await new Promise(() => {})
    } catch (error) {
<<<<<<< HEAD
      logger.error(
        'transaction subscription unavailable, continuing with compensation polling only',
        error
      )
      await compensationPollingPromise
=======
      logger.error('transaction subscription unavailable, falling back to polling', error)
    await runPollingFallback(
      sql,
      client,
      config,
      logger,
      modules,
      seenDigests,
      webhookUrl,
      rpcPool
    )
>>>>>>> b31d6d1 (feat: Implement user activity syncing, indexing, and display across the frontend and indexer.)
    }
  } finally {
    if (!shuttingDown) {
      await sql.end({ timeout: 5 })
    }
  }
}

main().catch((error) => {
  console.error(
    '[indexer] fatal error',
    error instanceof Error ? error.stack ?? error.message : String(error)
  )
  process.exitCode = 1
})
