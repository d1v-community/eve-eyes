import { normalizeWalletAddress } from '../users/repository.mjs'

function parseJsonValue(value) {
  if (value == null) {
    return null
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  return value
}

function getProgrammableTransaction(rawContent) {
  return rawContent?.transaction?.data?.transaction?.kind === 'ProgrammableTransaction'
    ? rawContent.transaction.data.transaction
    : null
}

function resolveInput(input) {
  if (!input || typeof input !== 'object') {
    return null
  }

  if (input.type === 'pure') {
    return {
      kind: 'pure',
      value: input.value,
      valueType: input.valueType ?? null,
    }
  }

  if (input.type === 'object') {
    return {
      kind: 'object',
      objectId: input.objectId ?? null,
      objectType: input.objectType ?? null,
      mutable: input.mutable ?? null,
    }
  }

  return input
}

function resolveArgument(argument, inputs) {
  if (!argument || typeof argument !== 'object') {
    return null
  }

  if ('Input' in argument) {
    return resolveInput(inputs?.[argument.Input])
  }

  return argument
}

function resolveArguments(rawCall, rawContent) {
  const parsedRawCall = parseJsonValue(rawCall)
  const parsedRawContent = parseJsonValue(rawContent)
  const inputs = getProgrammableTransaction(parsedRawContent)?.inputs ?? []
  const argumentsList = Array.isArray(parsedRawCall?.arguments) ? parsedRawCall.arguments : []

  return argumentsList.map((argument) => resolveArgument(argument, inputs))
}

function getPureValue(argumentsList, index) {
  const value = argumentsList[index]

  if (value && typeof value === 'object' && value.kind === 'pure') {
    return value.value
  }

  return null
}

function normalizeAddress(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  try {
    return normalizeWalletAddress(value)
  } catch {
    return null
  }
}

function normalizeText(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function normalizeNumberLike(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return null
}

export function parseCreateCharacterMoveCall(row) {
  const argumentsList = resolveArguments(row.raw_call, row.raw_content)

  return {
    id: String(row.id),
    txDigest: row.tx_digest,
    callIndex: row.call_index,
    transactionTime: row.transaction_time,
    userId: normalizeNumberLike(getPureValue(argumentsList, 2)),
    tenant: normalizeText(getPureValue(argumentsList, 3)),
    tribeId: normalizeNumberLike(getPureValue(argumentsList, 4)),
    walletAddress: normalizeAddress(getPureValue(argumentsList, 5)),
    username: normalizeText(getPureValue(argumentsList, 6)),
  }
}

export async function listAllCharacterCreations(sql) {
  const rows = await sql`
    SELECT
      smc.id,
      smc.tx_digest,
      smc.call_index,
      smc.raw_call,
      smc.transaction_time,
      t.raw_content
    FROM suiscan_move_calls AS smc
    LEFT JOIN transaction_blocks AS t
      ON t.digest = smc.tx_digest
    WHERE smc.module_name = 'character'
      AND smc.function_name = 'create_character'
    ORDER BY smc.transaction_time DESC NULLS LAST, smc.id DESC
  `

  return rows.map((row) => parseCreateCharacterMoveCall(row))
}

export async function resolveCharacterLabels(
  sql,
  { walletAddresses = [], userIds = [] } = {}
) {
  const normalizedWalletAddresses = [
    ...new Set(walletAddresses.map((value) => normalizeAddress(value)).filter(Boolean)),
  ]
  const normalizedUserIds = [
    ...new Set(userIds.map((value) => normalizeNumberLike(value)).filter(Boolean)),
  ]

  if (normalizedWalletAddresses.length === 0 && normalizedUserIds.length === 0) {
    return {
      walletLabels: new Map(),
      userIdLabels: new Map(),
    }
  }

  const creations = await listAllCharacterCreations(sql)
  const walletLabels = new Map()
  const userIdLabels = new Map()

  for (const item of creations) {
    if (
      item.walletAddress &&
      normalizedWalletAddresses.includes(item.walletAddress) &&
      item.username &&
      !walletLabels.has(item.walletAddress)
    ) {
      walletLabels.set(item.walletAddress, item.username)
    }

    if (
      item.userId &&
      normalizedUserIds.includes(item.userId) &&
      item.username &&
      !userIdLabels.has(item.userId)
    ) {
      userIdLabels.set(item.userId, item.username)
    }
  }

  return {
    walletLabels,
    userIdLabels,
  }
}

function groupCharacterUserProfiles(creations) {
  const grouped = new Map()

  for (const item of creations) {
    const key = `${item.userId ?? ''}:${item.walletAddress ?? ''}:${item.tenant ?? ''}`
    const current =
      grouped.get(key) ??
      {
        userId: item.userId,
        username: item.username,
        walletAddress: item.walletAddress,
        tenant: item.tenant,
        tribeId: item.tribeId,
        firstCreatedAt: item.transactionTime,
        lastCreatedAt: item.transactionTime,
        creationCount: 0,
        creations: [],
      }

    current.creationCount += 1
    current.creations.push(item)

    if (item.username && !current.username) {
      current.username = item.username
    }

    if (item.transactionTime && (!current.firstCreatedAt || item.transactionTime < current.firstCreatedAt)) {
      current.firstCreatedAt = item.transactionTime
    }

    if (item.transactionTime && (!current.lastCreatedAt || item.transactionTime > current.lastCreatedAt)) {
      current.lastCreatedAt = item.transactionTime
      current.tribeId = item.tribeId
      if (item.username) {
        current.username = item.username
      }
    }

    grouped.set(key, current)
  }

  return [...grouped.values()].sort((left, right) => {
    const leftTime = left.lastCreatedAt ?? ''
    const rightTime = right.lastCreatedAt ?? ''
    return rightTime.localeCompare(leftTime)
  })
}

/**
 * @param {import('postgres').Sql<any>} sql
 * @param {{
 *   q?: string | null
 *   walletAddress?: string | null
 *   username?: string | null
 *   userId?: string | null
 * }} [input]
 */
export async function searchCharacterUsers(
  sql,
  { q = null, walletAddress = null, username = null, userId = null } = {}
) {
  const normalizedWalletAddress = normalizeAddress(walletAddress ?? q)
  const normalizedUsername = normalizeText(username ?? q)?.toLowerCase() ?? null
  const normalizedUserId = normalizeNumberLike(userId ?? q)
  const creations = await listAllCharacterCreations(sql)

  const matched = creations.filter((item) => {
    if (normalizedWalletAddress && item.walletAddress === normalizedWalletAddress) {
      return true
    }

    if (normalizedUserId && item.userId === normalizedUserId) {
      return true
    }

    if (normalizedUsername && item.username?.toLowerCase() === normalizedUsername) {
      return true
    }

    return false
  })

  return {
    query: {
      walletAddress: normalizedWalletAddress,
      username: normalizedUsername,
      userId: normalizedUserId,
    },
    profiles: groupCharacterUserProfiles(matched),
  }
}

export async function enrichActionEntitiesWithUsernames(sql, entities) {
  const accountAddresses = [
    ...new Set(
      (Array.isArray(entities) ? entities : [])
        .filter((entity) => entity?.kind === 'account' && typeof entity?.value === 'string')
        .map((entity) => entity.value)
    ),
  ]

  if (accountAddresses.length === 0) {
    return entities ?? []
  }

  const { walletLabels } = await resolveCharacterLabels(sql, {
    walletAddresses: accountAddresses,
  })

  return (entities ?? []).map((entity) => {
    if (entity?.kind !== 'account') {
      return entity
    }

    const displayValue = walletLabels.get(normalizeAddress(entity.value) ?? '')

    return displayValue
      ? {
          ...entity,
          displayValue,
        }
      : entity
  })
}
