import { getIndexerConfig } from '../src/config.mjs'
import {
  createSuiClient,
  fetchTransactionBlocks,
  resolvePackageModules,
} from '../src/sui.mjs'
import {
  bootstrapIndexerEnv,
  getMigrationsDirectory,
  processTransactionBlock,
} from '../src/ingest.mjs'
import { createLogger } from '../src/logger.mjs'
import { createSqlClient } from '../../frontend/src/app/server/db/client.mjs'
import { runPendingMigrations } from '../../frontend/src/app/server/db/migrations.mjs'

function getWebhookUrl() {
  return process.env.notify_webhook?.trim() || process.env.NOTIFY_WEBHOOK?.trim() || null
}

async function sendCompletionNotification(webhookUrl, summary) {
  if (!webhookUrl) {
    return
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      msg_type: 'text',
      content: {
        text: [
          '[eve-eyes] package transaction backfill completed',
          `network: ${summary.network}`,
          `package: ${summary.packageId}`,
          `modules: ${summary.modules}`,
          `pages: ${summary.pages}`,
          `known_digests_loaded: ${summary.knownDigestCount}`,
          `stored: ${summary.stored}`,
          `skipped_existing: ${summary.skippedExisting}`,
          `skipped_non_matching: ${summary.skippedNonMatching}`,
          `latest_transaction_time: ${summary.latestTransactionTime ?? 'none'}`,
        ].join('\n'),
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Webhook request failed with status ${response.status}`)
  }
}

function normalizeModuleFilter(packageId, moduleName, key) {
  return {
    [key]: {
      package: packageId,
      module: moduleName,
    },
  }
}

async function queryModuleEventsDescending(client, config, moduleName, cursor) {
  const filters = [
    normalizeModuleFilter(config.packageId, moduleName, 'MoveModule'),
    normalizeModuleFilter(config.packageId, moduleName, 'MoveEventModule'),
  ]

  let lastError

  for (const query of filters) {
    const attempts = [
      {
        query,
        cursor,
        limit: config.eventPageSize,
        order: 'descending',
      },
      {
        query,
        cursor,
        limit: config.eventPageSize,
        descendingOrder: true,
      },
      {
        query,
        cursor,
        limit: config.eventPageSize,
      },
    ]

    for (const params of attempts) {
      try {
        return await client.queryEvents(params)
      } catch (error) {
        lastError = error
      }
    }
  }

  throw lastError
}

async function loadExistingDigestSet(sql, network) {
  const rows = await sql`
    SELECT digest
    FROM transaction_blocks
    WHERE network = ${network}
  `

  return new Set(rows.map((row) => row.digest).filter(Boolean))
}

async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      await worker(items[currentIndex], currentIndex)
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
}

async function processDigests(sql, client, config, logger, digests, knownDigests) {
  const txBlocks = await fetchTransactionBlocks(client, digests, config)
  let insertedOrUpdatedCount = 0
  let skippedCount = 0
  let latestTransactionTime = null

  await runWithConcurrency(txBlocks, config.processConcurrency, async (txBlock) => {
    const result = await processTransactionBlock(sql, config, txBlock, logger)

    if (result.stored && result.digest) {
      knownDigests.add(result.digest)
      insertedOrUpdatedCount += 1
      latestTransactionTime = result.transactionTime ?? latestTransactionTime
      logger.info('stored transaction block', {
        digest: result.digest,
        checkpoint: result.checkpoint,
        transactionTime: result.transactionTime,
      })
      return
    }

    skippedCount += 1
    logger.info('skipped non-matching transaction block', {
      digest: result.digest,
      checkpoint: result.checkpoint,
      transactionTime: result.transactionTime,
    })
  })

  return {
    insertedOrUpdatedCount,
    skippedCount,
    latestTransactionTime,
  }
}

async function main() {
  const config = getIndexerConfig()
  const logger = createLogger('backfill-package-transaction-blocks')
  const webhookUrl = getWebhookUrl()

  await bootstrapIndexerEnv(config)

  const sql = createSqlClient()
  const client = createSuiClient(config)
  const migrationsDirectory = getMigrationsDirectory(config)

  try {
    await runPendingMigrations(sql, migrationsDirectory)

    const modules = await resolvePackageModules(client, config)
    const knownDigests = await loadExistingDigestSet(sql, config.network)
    const seenDigestsThisRun = new Set()

    logger.info('starting historical backfill', {
      packageId: config.packageId,
      network: config.network,
      rpcUrl: config.rpcUrl,
      moduleCount: modules.length,
      knownDigestCount: knownDigests.size,
      eventPageSize: config.eventPageSize,
      rpcBatchSize: config.rpcBatchSize,
      processConcurrency: config.processConcurrency,
    })

    let totalPages = 0
    let totalStored = 0
    let totalSkippedExisting = 0
    let totalSkippedNonMatching = 0
    let latestTransactionTime = null

    for (const moduleName of modules) {
      let cursor = null
      let pageCount = 0
      let moduleStored = 0

      while (true) {
        const page = await queryModuleEventsDescending(client, config, moduleName, cursor)
        const events = page?.data ?? []

        if (events.length === 0) {
          break
        }

        pageCount += 1
        totalPages += 1

        const pageDigests = [...new Set(events.map((event) => event?.id?.txDigest).filter(Boolean))]
        const freshDigests = pageDigests.filter(
          (digest) => !knownDigests.has(digest) && !seenDigestsThisRun.has(digest)
        )
        const duplicateDigests = pageDigests.filter(
          (digest) => knownDigests.has(digest) || seenDigestsThisRun.has(digest)
        )
        const duplicateCount = duplicateDigests.length

        for (const digest of duplicateDigests) {
          logger.info('duplicate digest already present, skipping store', {
            moduleName,
            digest,
          })
        }

        for (const digest of freshDigests) {
          seenDigestsThisRun.add(digest)
        }

        const result =
          freshDigests.length > 0
            ? await processDigests(sql, client, config, logger, freshDigests, knownDigests)
            : {
                insertedOrUpdatedCount: 0,
                skippedCount: 0,
              }

        totalStored += result.insertedOrUpdatedCount
        moduleStored += result.insertedOrUpdatedCount
        totalSkippedExisting += duplicateCount
        totalSkippedNonMatching += result.skippedCount
        latestTransactionTime = result.latestTransactionTime ?? latestTransactionTime

        const lastEvent = events.at(-1)
        cursor = page?.nextCursor ?? lastEvent?.id ?? null

        logger.info('processed historical event page', {
          moduleName,
          pageCount,
          eventCount: events.length,
          candidateTransactionCount: pageDigests.length,
          duplicateDigestCount: duplicateCount,
          fetchedDigestCount: freshDigests.length,
          storedTransactionCount: result.insertedOrUpdatedCount,
          skippedNonMatchingCount: result.skippedCount,
          latestEventDigest: lastEvent?.id?.txDigest ?? null,
          latestEventSequence: lastEvent?.id?.eventSeq ?? null,
          nextCursor: cursor,
        })

        if (!page?.hasNextPage || cursor === null) {
          break
        }
      }

      logger.info('completed module backfill', {
        moduleName,
        pageCount,
        storedTransactionCount: moduleStored,
      })
    }

    const summary = {
      network: config.network,
      packageId: config.packageId,
      modules: modules.length,
      pages: totalPages,
      knownDigestCount: knownDigests.size,
      stored: totalStored,
      skippedExisting: totalSkippedExisting,
      skippedNonMatching: totalSkippedNonMatching,
      latestTransactionTime,
    }

    console.log(`network: ${config.network}`)
    console.log(`package_id: ${config.packageId}`)
    console.log(`modules: ${modules.length}`)
    console.log(`pages: ${totalPages}`)
    console.log(`known_digests_loaded: ${knownDigests.size}`)
    console.log(`stored: ${totalStored}`)
    console.log(`skipped_existing: ${totalSkippedExisting}`)
    console.log(`skipped_non_matching: ${totalSkippedNonMatching}`)
    console.log(`latest_transaction_time: ${latestTransactionTime ?? 'none'}`)

    await sendCompletionNotification(webhookUrl, summary)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(
    '[backfill-package-transaction-blocks] fatal error',
    error instanceof Error ? error.stack ?? error.message : String(error)
  )
  process.exitCode = 1
})
