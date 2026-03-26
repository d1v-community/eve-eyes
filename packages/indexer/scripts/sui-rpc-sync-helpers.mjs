import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'

const defaultRpcUrls = [
  'https://sui-testnet-endpoint.blockvision.org',
  'https://sui-testnet-rpc.publicnode.com',
  'https://testnet-rpc.sui.chainbase.online',
  'https://sui-testnet.nodeinfra.com',
  'https://endpoints.omniatech.io/v1/sui/testnet/public',
  'https://sui-testnet.drpc.org',
  'https://rpc-sui-testnet.cosmostation.io',
  'https://sui-testnet-rpc.allthatnode.com',
  getFullnodeUrl('testnet'),
]

export function createLogger(scope) {
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

export function getRpcUrls() {
  const configuredUrls = (
    process.env.SUI_RPC_URLS ||
    process.env.SUI_RPC_URL ||
    process.env.SUI_INDEXER_RPC_URL ||
    ''
  )
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const uniqueUrls = [
    ...new Set(configuredUrls.length > 0 ? configuredUrls : defaultRpcUrls),
  ]

  if (uniqueUrls.length === 0) {
    throw new Error('No RPC URLs configured')
  }

  return uniqueUrls
}

export function createRpcPool() {
  const urls = getRpcUrls()
  const clients = urls.map((url) => ({
    url,
    client: new SuiClient({ url }),
  }))
  let nextClientIndex = 0

  return {
    urls,
    async getTransactionBlock(input) {
      let lastError

      for (let attempt = 0; attempt < clients.length; attempt += 1) {
        const currentIndex = nextClientIndex % clients.length
        nextClientIndex += 1
        const current = clients[currentIndex]

        try {
          const result = await current.client.getTransactionBlock(input)

          return {
            result,
            rpcUrl: current.url,
          }
        } catch (error) {
          lastError = error
        }
      }

      throw lastError
    },
    async multiGetTransactionBlocks(input) {
      let lastError

      for (let attempt = 0; attempt < clients.length; attempt += 1) {
        const currentIndex = nextClientIndex % clients.length
        nextClientIndex += 1
        const current = clients[currentIndex]

        try {
          const result = await current.client.multiGetTransactionBlocks(input)

          return {
            result,
            rpcUrl: current.url,
          }
        } catch (error) {
          lastError = error
        }
      }

      throw lastError
    },
    async tryGetPastObject(input) {
      let lastError

      for (let attempt = 0; attempt < clients.length; attempt += 1) {
        const currentIndex = nextClientIndex % clients.length
        nextClientIndex += 1
        const current = clients[currentIndex]

        try {
          const result = await current.client.tryGetPastObject(input)

          return {
            result,
            rpcUrl: current.url,
          }
        } catch (error) {
          lastError = error
        }
      }

      throw lastError
    },
    async getObject(input) {
      let lastError

      for (let attempt = 0; attempt < clients.length; attempt += 1) {
        const currentIndex = nextClientIndex % clients.length
        nextClientIndex += 1
        const current = clients[currentIndex]

        try {
          const result = await current.client.getObject(input)

          return {
            result,
            rpcUrl: current.url,
          }
        } catch (error) {
          lastError = error
        }
      }

      throw lastError
    },
  }
}

export function extractMoveCalls(result) {
  const programmableTransactions =
    result?.transaction?.data?.transaction?.transactions

  if (!Array.isArray(programmableTransactions)) {
    return []
  }

  return programmableTransactions.flatMap((entry, callIndex) => {
    const moveCall = entry?.MoveCall

    if (!moveCall || typeof moveCall !== 'object') {
      return []
    }

    return [
      {
        callIndex,
        packageId:
          typeof moveCall.package === 'string' ? moveCall.package : null,
        moduleName:
          typeof moveCall.module === 'string' ? moveCall.module : null,
        functionName:
          typeof moveCall.function === 'string' ? moveCall.function : null,
        rawCall: moveCall,
      },
    ]
  })
}

export async function runWithConcurrency(items, concurrency, worker) {
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
