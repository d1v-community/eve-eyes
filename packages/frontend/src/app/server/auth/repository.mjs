import { getChallengeTtlSeconds, getMaxApiKeysPerUser } from './config.mjs'
import {
  createApiKeyValue,
  generateNonce,
  generateOpaqueId,
  getApiKeyPrefix,
  hashApiKey,
} from './crypto.mjs'
import { normalizeWalletAddress, upsertWalletUser } from '../users/repository.mjs'

function mapChallengeRow(row) {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    nonce: row.nonce,
    message: row.message,
    chain: row.chain,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  }
}

function mapApiKeyRow(row) {
  return {
    id: String(row.id),
    userId: row.user_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    rateLimitTps: row.rate_limit_tps,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  }
}

function buildWalletLoginMessage({ walletAddress, nonce, issuedAt, expiresAt, origin }) {
  return [
    'eve-eyes wallet login',
    '',
    'Sign this message to authenticate with eve-eyes.',
    'No blockchain transaction will be sent.',
    '',
    `Address: ${walletAddress}`,
    `Nonce: ${nonce}`,
    'Chain: sui',
    `Issued At: ${issuedAt}`,
    `Expires At: ${expiresAt}`,
    `Domain: ${origin}`,
  ].join('\n')
}

function normalizeApiKeyName(name) {
  const normalized = typeof name === 'string' ? name.trim() : ''

  if (!normalized) {
    throw new Error('name is required')
  }

  if (normalized.length > 80) {
    throw new Error('name must be 80 characters or fewer')
  }

  return normalized
}

export async function createWalletLoginChallenge(sql, input) {
  const walletAddress = normalizeWalletAddress(input?.walletAddress ?? '')
  const challengeId = generateOpaqueId()
  const nonce = generateNonce()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + getChallengeTtlSeconds() * 1000)
  const issuedAt = now.toISOString()
  const expiresAtIso = expiresAt.toISOString()
  const origin =
    typeof input?.origin === 'string' && input.origin.trim().length > 0
      ? input.origin.trim()
      : 'unknown'
  const message = buildWalletLoginMessage({
    walletAddress,
    nonce,
    issuedAt,
    expiresAt: expiresAtIso,
    origin,
  })

  await sql`
    DELETE FROM wallet_login_challenges
    WHERE expires_at < NOW() - INTERVAL '1 day'
       OR used_at IS NOT NULL
  `

  const rows = await sql`
    INSERT INTO wallet_login_challenges (
      id,
      wallet_address,
      nonce,
      message,
      chain,
      created_at,
      expires_at
    )
    VALUES (
      ${challengeId},
      ${walletAddress},
      ${nonce},
      ${message},
      'sui',
      NOW(),
      ${expiresAtIso}
    )
    RETURNING
      id,
      wallet_address,
      nonce,
      message,
      chain,
      created_at,
      expires_at,
      used_at
  `

  return mapChallengeRow(rows[0])
}

export async function getWalletLoginChallenge(sql, challengeId) {
  const rows = await sql`
    SELECT
      id,
      wallet_address,
      nonce,
      message,
      chain,
      created_at,
      expires_at,
      used_at
    FROM wallet_login_challenges
    WHERE id = ${challengeId}
    LIMIT 1
  `

  return rows[0] ? mapChallengeRow(rows[0]) : null
}

export async function consumeWalletLoginChallenge(sql, challengeId) {
  const rows = await sql`
    UPDATE wallet_login_challenges
    SET used_at = NOW()
    WHERE id = ${challengeId}
      AND used_at IS NULL
      AND expires_at > NOW()
    RETURNING
      id,
      wallet_address,
      nonce,
      message,
      chain,
      created_at,
      expires_at,
      used_at
  `

  return rows[0] ? mapChallengeRow(rows[0]) : null
}

export async function assertWalletLoginChallenge(sql, input) {
  const walletAddress = normalizeWalletAddress(input?.walletAddress ?? '')
  const challenge = await getWalletLoginChallenge(sql, input?.challengeId ?? '')

  if (!challenge) {
    throw new Error('challenge was not found')
  }

  if (challenge.walletAddress !== walletAddress) {
    throw new Error('challenge does not belong to walletAddress')
  }

  if (challenge.usedAt) {
    throw new Error('challenge has already been used')
  }

  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    throw new Error('challenge has expired')
  }

  if (typeof input?.message !== 'string' || input.message !== challenge.message) {
    throw new Error('message does not match challenge')
  }

  return {
    challenge,
    walletAddress,
  }
}

export async function finalizeWalletLogin(sql, input) {
  const walletAddress = normalizeWalletAddress(input?.walletAddress ?? '')
  const consumedChallenge = await consumeWalletLoginChallenge(sql, input?.challengeId ?? '')

  if (!consumedChallenge) {
    throw new Error('challenge is no longer valid')
  }

  const user = await upsertWalletUser(sql, {
    walletAddress,
    walletName: input?.walletName ?? null,
    chain: 'sui',
  })

  return {
    challenge: consumedChallenge,
    user,
  }
}

export async function listUserApiKeys(sql, userId) {
  const rows = await sql`
    SELECT
      id,
      user_id,
      name,
      key_prefix,
      rate_limit_tps,
      created_at,
      updated_at,
      last_used_at,
      revoked_at
    FROM user_api_keys
    WHERE user_id = ${userId}
    ORDER BY created_at DESC, id DESC
  `

  return rows.map(mapApiKeyRow)
}

export async function createUserApiKey(sql, userId, input) {
  const name = normalizeApiKeyName(input?.name)

  return sql.begin(async (transaction) => {
    const activeKeyRows = await transaction`
      SELECT COUNT(*)::int AS key_count
      FROM user_api_keys
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
    `

    if ((activeKeyRows[0]?.key_count ?? 0) >= getMaxApiKeysPerUser()) {
      throw new Error('maximum active API keys reached')
    }

    const apiKey = createApiKeyValue()
    const keyHash = hashApiKey(apiKey)
    const keyPrefix = getApiKeyPrefix(apiKey)

    const rows = await transaction`
      INSERT INTO user_api_keys (
        user_id,
        name,
        key_prefix,
        key_hash,
        rate_limit_tps,
        created_at,
        updated_at
      )
      VALUES (
        ${userId},
        ${name},
        ${keyPrefix},
        ${keyHash},
        5,
        NOW(),
        NOW()
      )
      RETURNING
        id,
        user_id,
        name,
        key_prefix,
        rate_limit_tps,
        created_at,
        updated_at,
        last_used_at,
        revoked_at
    `

    return {
      apiKey,
      record: mapApiKeyRow(rows[0]),
    }
  })
}

export async function revokeUserApiKey(sql, userId, apiKeyId) {
  const rows = await sql`
    UPDATE user_api_keys
    SET revoked_at = NOW(),
        updated_at = NOW()
    WHERE id = ${apiKeyId}
      AND user_id = ${userId}
      AND revoked_at IS NULL
    RETURNING
      id,
      user_id,
      name,
      key_prefix,
      rate_limit_tps,
      created_at,
      updated_at,
      last_used_at,
      revoked_at
  `

  return rows[0] ? mapApiKeyRow(rows[0]) : null
}

export async function findApiKeyByValue(sql, apiKey) {
  const keyHash = hashApiKey(apiKey)
  const rows = await sql`
    SELECT
      id,
      user_id,
      name,
      key_prefix,
      key_hash,
      rate_limit_tps,
      created_at,
      updated_at,
      last_used_at,
      revoked_at
    FROM user_api_keys
    WHERE key_hash = ${keyHash}
    LIMIT 1
  `

  if (!rows[0]) {
    return null
  }

  return {
    ...mapApiKeyRow(rows[0]),
    keyHash: rows[0].key_hash,
  }
}

export async function markApiKeyUsed(sql, apiKeyId) {
  await sql`
    UPDATE user_api_keys
    SET last_used_at = NOW(),
        updated_at = NOW()
    WHERE id = ${apiKeyId}
  `
}

export async function enforceApiKeyRateLimit(sql, apiKeyRecord) {
  const rows = await sql.begin(async (transaction) => {
    await transaction`
      DELETE FROM api_key_rate_limit_windows
      WHERE window_started_at < NOW() - INTERVAL '10 minutes'
    `

    const windowRows = await transaction`
      INSERT INTO api_key_rate_limit_windows (
        api_key_id,
        window_started_at,
        request_count,
        created_at,
        updated_at
      )
      VALUES (
        ${apiKeyRecord.id},
        date_trunc('second', NOW()),
        1,
        NOW(),
        NOW()
      )
      ON CONFLICT (api_key_id, window_started_at)
      DO UPDATE SET
        request_count = api_key_rate_limit_windows.request_count + 1,
        updated_at = NOW()
      RETURNING request_count
    `

    return windowRows
  })

  const currentCount = rows[0]?.request_count ?? 0

  if (currentCount > apiKeyRecord.rateLimitTps) {
    throw new Error('API key rate limit exceeded')
  }
}
