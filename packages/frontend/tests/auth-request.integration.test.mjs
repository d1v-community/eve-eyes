import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from '../scripts/load-env.mjs'
import { createSqlClient } from '../src/app/server/db/client.mjs'
import { runPendingMigrations } from '../src/app/server/db/migrations.mjs'
import {
  createUserApiKey,
  createWalletLoginChallenge,
  finalizeWalletLogin,
} from '../src/app/server/auth/repository.mjs'
import {
  requireAuthenticatedRequest,
  requireJwtRequest,
  resolveRequestAuth,
} from '../src/app/server/auth/request.mjs'
import { signAccessToken } from '../src/app/server/auth/jwt.mjs'

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
await loadProjectEnv(projectRoot)

const databaseUrl = process.env.DATABASE_URL
const migrationsDirectory = path.join(projectRoot, 'db', 'migrations')
const originalAuthSecret = process.env.AUTH_SECRET

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-auth-secret-change-me'

test.after(() => {
  process.env.AUTH_SECRET = originalAuthSecret
})

test('request auth resolves JWT callers from token user snapshot without a database lookup', async () => {
  const { token } = signAccessToken({
    sub: 'user-1',
    walletAddress: '0x1234',
    chain: 'sui',
    user: {
      id: 'user-1',
      walletAddress: '0x1234',
      walletName: 'Snapshot Wallet',
      chain: 'sui',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    },
  })

  const auth = await requireJwtRequest(
    Object.freeze({}),
    new Request('http://localhost/api/auth/me', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    })
  )

  assert.equal(auth.type, 'jwt')
  assert.equal(auth.userId, 'user-1')
  assert.equal(auth.user.walletName, 'Snapshot Wallet')
})

test('request auth resolves anonymous, jwt, and api key callers', async (t) => {
  if (!databaseUrl) {
    t.skip('DATABASE_URL is not configured')
    return
  }

  const sql = createSqlClient(databaseUrl)
  const walletAddress = `0x${crypto.randomBytes(32).toString('hex')}`

  await runPendingMigrations(sql, migrationsDirectory)

  try {
    const anonymous = await resolveRequestAuth(
      sql,
      new Request('http://localhost/api/indexer/transaction-blocks?page=1')
    )

    assert.equal(anonymous.type, 'anonymous')
    assert.equal(anonymous.userId, null)

    const challenge = await createWalletLoginChallenge(sql, {
      walletAddress,
      origin: 'http://localhost:3000',
    })
    const login = await finalizeWalletLogin(sql, {
      challengeId: challenge.id,
      walletAddress,
      walletName: 'Resolver Wallet',
    })
    const { token } = signAccessToken({
      sub: login.user.id,
      walletAddress: login.user.walletAddress,
      chain: login.user.chain,
    })

    const jwtAuth = await requireJwtRequest(
      sql,
      new Request('http://localhost/api/auth/me', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      })
    )

    assert.equal(jwtAuth.type, 'jwt')
    assert.equal(jwtAuth.user.walletAddress, walletAddress.toLowerCase())

    const createdApiKey = await createUserApiKey(sql, login.user.id, {
      name: 'Resolver key',
    })
    const apiKeyAuth = await requireAuthenticatedRequest(
      sql,
      new Request('http://localhost/api/indexer/move-calls?page=4', {
        headers: {
          'x-api-key': createdApiKey.apiKey,
        },
      })
    )

    assert.equal(apiKeyAuth.type, 'apiKey')
    assert.equal(apiKeyAuth.userId, login.user.id)

    await assert.rejects(
      () =>
        requireJwtRequest(
          sql,
          new Request('http://localhost/api/auth/api-keys', {
            headers: {
              'x-api-key': createdApiKey.apiKey,
            },
          })
        ),
      /JWT authentication is required/
    )
  } finally {
    await sql`DELETE FROM users WHERE wallet_address = ${walletAddress.toLowerCase()}`
    await sql.end({ timeout: 5 })
  }
})
