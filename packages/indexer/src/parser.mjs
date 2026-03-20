function asLowerText(value) {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

function getTransactionData(txBlock) {
  return txBlock?.transaction?.data ?? {}
}

function getProgrammableTransactions(txBlock) {
  return getTransactionData(txBlock)?.transaction?.transactions ?? []
}

function extractTransactionKind(txBlock) {
  const transaction = getTransactionData(txBlock)?.transaction

  if (typeof transaction?.kind === 'string' && transaction.kind.length > 0) {
    return transaction.kind
  }

  if (Array.isArray(transaction?.transactions) && transaction.transactions.length > 0) {
    return 'ProgrammableTransaction'
  }

  return null
}

function extractMoveCallTargets(txBlock) {
  return getProgrammableTransactions(txBlock)
    .map((transaction) => {
      if (typeof transaction?.target === 'string') {
        return transaction.target
      }

      if (typeof transaction?.MoveCall?.target === 'string') {
        return transaction.MoveCall.target
      }

      const pkg = transaction?.MoveCall?.package
      const moduleName = transaction?.MoveCall?.module
      const functionName = transaction?.MoveCall?.function

      if (pkg && moduleName && functionName) {
        return `${pkg}::${moduleName}::${functionName}`
      }

      return null
    })
    .filter(Boolean)
}

function packagePrefix(packageId) {
  return `${packageId}::`
}

export function transactionBlockReferencesPackage(txBlock, packageId) {
  const prefix = packagePrefix(packageId)
  const moveCalls = extractMoveCallTargets(txBlock)

  if (moveCalls.some((target) => asLowerText(target).startsWith(prefix))) {
    return true
  }

  if (
    (txBlock?.events ?? []).some((event) =>
      asLowerText(event?.type).startsWith(prefix)
    )
  ) {
    return true
  }

  if (
    (txBlock?.objectChanges ?? []).some((change) => {
      const objectType = asLowerText(change?.objectType)
      const displayType = asLowerText(change?.type)

      return objectType.startsWith(prefix) || displayType.includes(prefix)
    })
  ) {
    return true
  }

  return JSON.stringify(txBlock?.transaction ?? {}).toLowerCase().includes(prefix)
}

export function buildTransactionBlockRecord(txBlock, config) {
  const transactionData = getTransactionData(txBlock)

  return {
    digest: txBlock.digest,
    network: config.network,
    checkpoint:
      txBlock.checkpoint == null ? null : String(txBlock.checkpoint),
    senderAddress: transactionData?.sender ?? null,
    transactionKind: extractTransactionKind(txBlock),
    status: txBlock?.effects?.status?.status ?? null,
    errorMessage: txBlock?.effects?.status?.error ?? null,
    executedAt:
      txBlock?.timestampMs == null
        ? null
        : new Date(Number(txBlock.timestampMs)).toISOString(),
    transactionTime:
      txBlock?.timestampMs == null
        ? null
        : new Date(Number(txBlock.timestampMs)).toISOString(),
    rawContent: txBlock,
    effects: txBlock?.effects ?? null,
    events: txBlock?.events ?? [],
    objectChanges: txBlock?.objectChanges ?? [],
    balanceChanges: txBlock?.balanceChanges ?? [],
  }
}
