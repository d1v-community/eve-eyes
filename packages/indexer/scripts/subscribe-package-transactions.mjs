import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { setTimeout as delay } from 'node:timers/promises'
import { loadProjectEnv } from './load-env.mjs'

const PACKAGE_ID =
  '0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')

function getWebhookUrl() {
  return process.env.notify_webhook?.trim() || process.env.NOTIFY_WEBHOOK?.trim() || null
}

function getRpcUrl() {
  return process.env.SUI_INDEXER_RPC_URL?.trim() || getFullnodeUrl('testnet')
}

function getWebsocketUrl(rpcUrl) {
  const configured =
    process.env.SUI_INDEXER_WS_URL?.trim() || process.env.SUI_INDEXER_WEBSOCKET_URL?.trim()

  if (configured) {
    return configured
  }

  const url = new URL(rpcUrl)
  url.protocol = url.protocol.replace('http', 'ws')
  return url.toString()
}

function getPollIntervalMs() {
  const value = process.env.SUI_INDEXER_SUBSCRIBE_POLL_INTERVAL_MS?.trim()

  if (!value) {
    return 5000
  }

  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error('SUI_INDEXER_SUBSCRIBE_POLL_INTERVAL_MS must be a positive integer')
  }

  return parsed
}

function getDigest(message) {
  return message?.digest ?? message?.transactionDigest ?? null
}

function getTransactionTime(txBlock) {
  return txBlock?.timestampMs == null
    ? null
    : new Date(Number(txBlock.timestampMs)).toISOString()
}

function normalizeModuleFilter(moduleName, key) {
  return {
    [key]: {
      package: PACKAGE_ID,
      module: moduleName,
    },
  }
}

async function sendWebhookNotification(webhookUrl, digest, rpcUrl, transactionTime) {
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
          `package: ${PACKAGE_ID}`,
          `digest: ${digest}`,
          `rpc: ${rpcUrl}`,
          `transaction_time: ${transactionTime ?? 'unknown'}`,
        ].join('\n'),
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Webhook request failed with status ${response.status}`)
  }
}

async function notifyDigest(client, webhookUrl, digest, rpcUrl, seenDigests) {
  if (!digest || seenDigests.has(digest)) {
    return
  }

  seenDigests.add(digest)

  try {
    const txBlock = await client.getTransactionBlock({
      digest,
      options: {
        showEffects: true,
      },
    })
    const transactionTime = getTransactionTime(txBlock)

    await sendWebhookNotification(webhookUrl, digest, rpcUrl, transactionTime)
    console.log('[subscribe-package-transactions] notified', {
      digest,
      transactionTime,
    })
  } catch (error) {
    console.error(
      '[subscribe-package-transactions] notification failed',
      error instanceof Error ? error.stack ?? error.message : String(error)
    )
  }
}

async function subscribeWithTimeout(client, rpcUrl, webhookUrl, seenDigests) {
  const subscribePromise = client.subscribeTransaction({
    filter: {
      MoveFunction: {
        package: PACKAGE_ID,
      },
    },
    onMessage: (message) => {
      const digest = getDigest(message)
      void notifyDigest(client, webhookUrl, digest, rpcUrl, seenDigests)
    },
  })

  const timeoutMs = 10000
  const timeoutPromise = delay(timeoutMs).then(() => {
    throw new Error(`Subscription setup timed out after ${timeoutMs}ms`)
  })

  return Promise.race([subscribePromise, timeoutPromise])
}

async function pollTransactions(client, rpcUrl, webhookUrl, seenDigests, pollIntervalMs) {
  console.log('[subscribe-package-transactions] falling back to polling mode', {
    packageId: PACKAGE_ID,
    rpcUrl,
    pollIntervalMs,
  })

  const modules = Object.keys(
    await client.getNormalizedMoveModulesByPackage({
      package: PACKAGE_ID,
    })
  ).sort()
  const moduleCursors = new Map()

  console.log('[subscribe-package-transactions] resolved modules for polling', {
    moduleCount: modules.length,
    modules,
  })

  while (true) {
    for (const moduleName of modules) {
      const currentCursor = moduleCursors.get(moduleName) ?? null

      try {
        const page = await client.queryEvents({
          query: normalizeModuleFilter(moduleName, 'MoveModule'),
          cursor: currentCursor,
          limit: 20,
          order: currentCursor ? 'ascending' : 'descending',
        })

        const events = page?.data ?? []

        if (currentCursor === null) {
          const latestEvent = events[0]?.id ?? null

          if (latestEvent) {
            moduleCursors.set(moduleName, latestEvent)
          }

          continue
        }

        for (const event of events) {
          const digest = event?.id?.txDigest ?? null
          await notifyDigest(client, webhookUrl, digest, rpcUrl, seenDigests)
        }

        const latestEvent = events.at(-1)?.id ?? currentCursor
        moduleCursors.set(moduleName, latestEvent)
      } catch (error) {
        console.error(
          '[subscribe-package-transactions] polling failed',
          {
            moduleName,
            message: error instanceof Error ? error.stack ?? error.message : String(error),
          }
        )
      }
    }

    await delay(pollIntervalMs)
  }
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)

  const webhookUrl = getWebhookUrl()

  if (!webhookUrl) {
    throw new Error('notify_webhook or NOTIFY_WEBHOOK is not configured')
  }

  const rpcUrl = getRpcUrl()
  const websocketUrl = getWebsocketUrl(rpcUrl)
  const pollIntervalMs = getPollIntervalMs()
  const client = new SuiClient({
    url: rpcUrl,
    websocket: {
      url: websocketUrl,
    },
  })
  const seenDigests = new Set()

  console.log('[subscribe-package-transactions] starting', {
    packageId: PACKAGE_ID,
    rpcUrl,
    websocketUrl,
  })

  try {
    const unsubscribe = await subscribeWithTimeout(
      client,
      rpcUrl,
      webhookUrl,
      seenDigests
    )

    console.log('[subscribe-package-transactions] subscribed', {
      packageId: PACKAGE_ID,
    })

    process.on('SIGINT', () => {
      void unsubscribe().finally(() => process.exit(0))
    })

    process.on('SIGTERM', () => {
      void unsubscribe().finally(() => process.exit(0))
    })

    await new Promise(() => {})
  } catch (error) {
    console.error(
      '[subscribe-package-transactions] websocket subscription unavailable',
      error instanceof Error ? error.message : String(error)
    )

    await pollTransactions(
      client,
      rpcUrl,
      webhookUrl,
      seenDigests,
      pollIntervalMs
    )
  }
}

main().catch((error) => {
  console.error(
    '[subscribe-package-transactions] fatal error',
    error instanceof Error ? error.stack ?? error.message : String(error)
  )
  process.exitCode = 1
})
