import { normalizeWalletAddress } from '../users/repository.mjs'

function normalizeOptionalText(value) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function parseTransactionBlockFilters(searchParams) {
  return {
    network: normalizeOptionalText(searchParams.get('network')),
    senderAddress: normalizeOptionalText(searchParams.get('senderAddress')),
    status: normalizeOptionalText(searchParams.get('status')),
    digest: normalizeOptionalText(searchParams.get('digest')),
    transactionKind: normalizeOptionalText(searchParams.get('transactionKind')),
  }
}

export function parseMoveCallFilters(searchParams) {
  return {
    network: normalizeOptionalText(searchParams.get('network')),
    senderAddress: normalizeOptionalText(searchParams.get('senderAddress')),
    status: normalizeOptionalText(searchParams.get('status')),
    txDigest: normalizeOptionalText(searchParams.get('txDigest')),
    packageId: normalizeOptionalText(searchParams.get('packageId')),
    moduleName: normalizeOptionalText(searchParams.get('moduleName')),
    functionName: normalizeOptionalText(searchParams.get('functionName')),
  }
}

export async function listTransactionBlocks(sql, input) {
  const conditions = []
  const params = []

  const push = (field, value) => {
    params.push(value)
    conditions.push(`${field} = $${params.length}`)
  }

  if (input.filters.network) {
    push('network', input.filters.network)
  }
  if (input.filters.senderAddress) {
    push('sender_address', normalizeWalletAddress(input.filters.senderAddress))
  }
  if (input.filters.status) {
    push('status', input.filters.status)
  }
  if (input.filters.digest) {
    push('digest', input.filters.digest)
  }
  if (input.filters.transactionKind) {
    push('transaction_kind', input.filters.transactionKind)
  }

  const whereText = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const listParams = [...params, input.pageSize, input.offset]
  const rows = await sql.unsafe(
    `
      SELECT
        id,
        digest,
        network,
        checkpoint,
        sender_address,
        transaction_kind,
        status,
        error_message,
        executed_at,
        transaction_time,
        created_at,
        updated_at
      FROM transaction_blocks
      ${whereText}
      ORDER BY transaction_time DESC NULLS LAST, id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    listParams
  )
  const countRows = await sql.unsafe(
    `
      SELECT COUNT(*)::int AS total
      FROM transaction_blocks
      ${whereText}
    `,
    params
  )

  return {
    items: rows.map((row) => ({
      id: String(row.id),
      digest: row.digest,
      network: row.network,
      checkpoint: row.checkpoint,
      senderAddress: row.sender_address,
      transactionKind: row.transaction_kind,
      status: row.status,
      errorMessage: row.error_message,
      executedAt: row.executed_at,
      transactionTime: row.transaction_time,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    total: countRows[0]?.total ?? 0,
  }
}

export async function listMoveCalls(sql, input) {
  const conditions = []
  const params = []

  const push = (field, value) => {
    params.push(value)
    conditions.push(`${field} = $${params.length}`)
  }

  if (input.filters.network) {
    push('t.network', input.filters.network)
  }
  if (input.filters.senderAddress) {
    push('t.sender_address', normalizeWalletAddress(input.filters.senderAddress))
  }
  if (input.filters.status) {
    push('t.status', input.filters.status)
  }
  if (input.filters.txDigest) {
    push('smc.tx_digest', input.filters.txDigest)
  }
  if (input.filters.packageId) {
    push('smc.package_id', input.filters.packageId)
  }
  if (input.filters.moduleName) {
    push('smc.module_name', input.filters.moduleName)
  }
  if (input.filters.functionName) {
    push('smc.function_name', input.filters.functionName)
  }

  const whereText = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = await sql.unsafe(
    `
      SELECT
        smc.id,
        smc.tx_digest,
        smc.call_index,
        smc.package_id,
        smc.module_name,
        smc.function_name,
        smc.transaction_time,
        smc.created_at,
        t.network,
        t.sender_address,
        t.status,
        t.checkpoint
      FROM suiscan_move_calls AS smc
      LEFT JOIN transaction_blocks AS t
        ON t.digest = smc.tx_digest
      ${whereText}
      ORDER BY smc.transaction_time DESC NULLS LAST, smc.id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, input.pageSize, input.offset]
  )
  const countRows = await sql.unsafe(
    `
      SELECT COUNT(*)::int AS total
      FROM suiscan_move_calls AS smc
      LEFT JOIN transaction_blocks AS t
        ON t.digest = smc.tx_digest
      ${whereText}
    `,
    params
  )

  return {
    items: rows.map((row) => ({
      id: String(row.id),
      txDigest: row.tx_digest,
      callIndex: row.call_index,
      packageId: row.package_id,
      moduleName: row.module_name,
      functionName: row.function_name,
      transactionTime: row.transaction_time,
      createdAt: row.created_at,
      network: row.network,
      senderAddress: row.sender_address,
      status: row.status,
      checkpoint: row.checkpoint,
    })),
    total: countRows[0]?.total ?? 0,
  }
}
