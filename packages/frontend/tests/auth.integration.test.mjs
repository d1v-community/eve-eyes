import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from '../scripts/load-env.mjs'
import { createSqlClient } from '../src/app/server/db/client.mjs'
import { runPendingMigrations } from '../src/app/server/db/migrations.mjs'
import {
  assertWalletLoginChallenge,
  createUserApiKey,
  createWalletLoginChallenge,
  enforceApiKeyRateLimit,
  findApiKeyByValue,
  finalizeWalletLogin,
  revokeUserApiKey,
} from '../src/app/server/auth/repository.mjs'
import { hashApiKey } from '../src/app/server/auth/crypto.mjs'
import { signAccessToken, verifyAccessToken } from '../src/app/server/auth/jwt.mjs'
import {
  ACCESS_TOKEN_COOKIE_NAME,
  parseCookies,
  serializeCookie,
} from '../src/app/server/auth/cookies.mjs'

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
await loadProjectEnv(projectRoot)

const databaseUrl = process.env.DATABASE_URL
const migrationsDirectory = path.join(projectRoot, 'db', 'migrations')
const originalAuthSecret = process.env.AUTH_SECRET

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-auth-secret-change-me'

test.after(() => {
  process.env.AUTH_SECRET = originalAuthSecret
})

test('JWT round-trip and cookies work for auth token transport', () => {
  const { token } = signAccessToken({
    sub: '0x1234',
    walletAddress: '0x1234',
    chain: 'sui',
  })
  const payload = verifyAccessToken(token)
  const serialized = serializeCookie(ACCESS_TOKEN_COOKIE_NAME, token, {
    maxAge: 60,
  })
  const parsedCookies = parseCookies(serialized)

  assert.equal(payload.sub, '0x1234')
  assert.equal(payload.walletAddress, '0x1234')
  assert.equal(parsedCookies[ACCESS_TOKEN_COOKIE_NAME], token)
})

test('wallet challenge lifecycle and API keys work', async (t) => {
  if (!databaseUrl) {
    t.skip('DATABASE_URL is not configured')
    return
  }

  const sql = createSqlClient(databaseUrl)
  const walletAddress = `0x${crypto.randomBytes(32).toString('hex')}`

  await runPendingMigrations(sql, migrationsDirectory)

  try {
    const challenge = await createWalletLoginChallenge(sql, {
      walletAddress,
      origin: 'http://localhost:3000',
    })
    const prepared = await assertWalletLoginChallenge(sql, {
      challengeId: challenge.id,
      walletAddress,
      message: challenge.message,
    })

    assert.equal(prepared.challenge.id, challenge.id)
    assert.equal(prepared.walletAddress, walletAddress.toLowerCase())

    const login = await finalizeWalletLogin(sql, {
      challengeId: challenge.id,
      walletAddress,
      walletName: 'Integration Wallet',
    })

    assert.equal(login.user.walletAddress, walletAddress.toLowerCase())

    const createdKey = await createUserApiKey(sql, login.user.id, {
      name: 'Primary key',
    })
    const storedKey = await findApiKeyByValue(sql, createdKey.apiKey)

    assert.ok(storedKey)
    assert.equal(storedKey?.keyHash, hashApiKey(createdKey.apiKey))

    await assert.rejects(
      () =>
        enforceApiKeyRateLimit(sql, {
          ...storedKey,
          rateLimitTps: 0,
        }),
      /API key rate limit exceeded/
    )

    const revoked = await revokeUserApiKey(sql, login.user.id, Number(createdKey.record.id))

    assert.ok(revoked)
    assert.notEqual(revoked?.revokedAt, null)
  } finally {
    await sql`DELETE FROM users WHERE wallet_address = ${walletAddress.toLowerCase()}`
    await sql.end({ timeout: 5 })
  }
})
