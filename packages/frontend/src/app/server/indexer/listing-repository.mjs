import { normalizeWalletAddress } from '../users/repository.mjs'
import { withMoveCallAction, withMoveCallActions } from './move-call-action.mjs'

function normalizeOptionalText(value) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeOptionalInteger(value, label, { allowZero = false } = {}) {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = String(value).trim()

  if (!normalized) {
    return null
  }

  const parsed = Number.parseInt(normalized, 10)

  if (Number.isNaN(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) {
    throw new Error(
      `${label} must be a ${allowZero ? 'non-negative' : 'positive'} integer`
    )
  }

  return parsed
}

export function parseTransactionBlockFilters(searchParams) {
  return {
    network: normalizeOptionalText(searchParams.get('network')),
    senderAddress: normalizeOptionalText(searchParams.get('senderAddress')),
    status: normalizeOptionalText(searchParams.get('status')),
    digest: normalizeOptionalText(searchParams.get('digest')),
    transactionKind: normalizeOptionalText(searchParams.get('transactionKind')),
    checkpoint: normalizeOptionalInteger(searchParams.get('checkpoint'), 'checkpoint'),
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
    callIndex: normalizeOptionalInteger(searchParams.get('callIndex'), 'callIndex', {
      allowZero: true,
    }),
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
  if (input.filters.checkpoint != null) {
    push('checkpoint', input.filters.checkpoint)
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

export async function getTransactionBlockByDigest(sql, digest) {
  const rows = await sql`
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
      raw_content,
      effects,
      events,
      object_changes,
      balance_changes,
      created_at,
      updated_at
    FROM transaction_blocks
    WHERE digest = ${digest}
    LIMIT 1
  `

  const row = rows[0]

  if (!row) {
    return null
  }

  return {
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
    rawContent: row.raw_content,
    effects: row.effects,
    events: row.events,
    objectChanges: row.object_changes,
    balanceChanges: row.balance_changes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listMoveCallsByTxDigest(sql, txDigest, options = {}) {
  const rows = await sql`
    SELECT
      smc.id,
      smc.tx_digest,
      smc.call_index,
      smc.package_id,
      smc.module_name,
      smc.function_name,
      smc.raw_call,
      smc.transaction_time,
      smc.created_at,
      ${options.includeActionSummary ? sql`t.raw_content,` : sql``}
      t.network,
      t.sender_address,
      t.status,
      t.checkpoint
    FROM suiscan_move_calls AS smc
    LEFT JOIN transaction_blocks AS t
      ON t.digest = smc.tx_digest
    WHERE smc.tx_digest = ${txDigest}
    ORDER BY smc.call_index ASC NULLS LAST, smc.id ASC
  `

  const items = rows.map((row) => {
    const item = {
      id: String(row.id),
      txDigest: row.tx_digest,
      callIndex: row.call_index,
      packageId: row.package_id,
      moduleName: row.module_name,
      functionName: row.function_name,
      rawCall: row.raw_call,
      transactionTime: row.transaction_time,
      createdAt: row.created_at,
      network: row.network,
      senderAddress: row.sender_address,
      status: row.status,
      checkpoint: row.checkpoint,
    }

    return item
  })

  if (!options.includeActionSummary) {
    return items
  }

  return withMoveCallActions(items, rows[0]?.raw_content ?? null)
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
  if (input.filters.callIndex != null) {
    push('smc.call_index', input.filters.callIndex)
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
        smc.raw_call,
        smc.transaction_time,
        smc.created_at,
        ${input.includeActionSummary ? 't.raw_content,' : ''}
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
    items: rows.map((row) => {
      const item = {
        id: String(row.id),
        txDigest: row.tx_digest,
        callIndex: row.call_index,
        packageId: row.package_id,
        moduleName: row.module_name,
        functionName: row.function_name,
        rawCall: row.raw_call,
        transactionTime: row.transaction_time,
        createdAt: row.created_at,
        network: row.network,
        senderAddress: row.sender_address,
        status: row.status,
        checkpoint: row.checkpoint,
      }

      if (!input.includeActionSummary) {
        return item
      }

      return withMoveCallAction({
        ...item,
        rawContent: row.raw_content,
      })
    }),
    total: countRows[0]?.total ?? 0,
  }
}

export async function getMoveCallByTxDigestAndCallIndex(sql, txDigest, callIndex) {
  const rows = await sql`
    SELECT
      smc.id,
      smc.tx_digest,
      smc.call_index,
      smc.package_id,
      smc.module_name,
      smc.function_name,
      smc.raw_call,
      smc.transaction_time,
      smc.created_at,
      t.raw_content,
      t.network,
      t.sender_address,
      t.status,
      t.checkpoint
    FROM suiscan_move_calls AS smc
    LEFT JOIN transaction_blocks AS t
      ON t.digest = smc.tx_digest
    WHERE smc.tx_digest = ${txDigest}
      AND smc.call_index = ${callIndex}
    LIMIT 1
  `

  const row = rows[0]

  if (!row) {
    return null
  }

  return withMoveCallAction({
    id: String(row.id),
    txDigest: row.tx_digest,
    callIndex: row.call_index,
    packageId: row.package_id,
    moduleName: row.module_name,
    functionName: row.function_name,
    rawCall: row.raw_call,
    rawContent: row.raw_content,
    transactionTime: row.transaction_time,
    createdAt: row.created_at,
    network: row.network,
    senderAddress: row.sender_address,
    status: row.status,
    checkpoint: row.checkpoint,
  })
}
