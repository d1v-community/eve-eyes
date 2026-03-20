import { verifyPersonalMessageSignature } from '@mysten/sui/verify'
import { ACCESS_TOKEN_COOKIE_NAME, serializeCookie } from '~~/server/auth/cookies.mjs'
import { getJwtTtlSeconds } from '~~/server/auth/config.mjs'
import { signAccessToken } from '~~/server/auth/jwt.mjs'
import {
  assertWalletLoginChallenge,
  finalizeWalletLogin,
} from '~~/server/auth/repository.mjs'
import { getSqlClient } from '~~/server/db/client.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

function decodeSignedBytes(bytes: string) {
  const trimmed = typeof bytes === 'string' ? bytes.trim() : ''

  if (!trimmed) {
    throw new Error('bytes is required')
  }

  return Buffer.from(trimmed, 'base64')
}

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const payload = await request.json()
    const messageBytes = decodeSignedBytes(payload?.bytes)
    const message = messageBytes.toString('utf8')

    if (typeof payload?.signature !== 'string' || payload.signature.trim().length === 0) {
      return json({ error: 'signature is required' }, { status: 400 })
    }

    const sql = getSqlClient()
    const preparedLogin = await assertWalletLoginChallenge(sql, {
      challengeId: payload?.challengeId,
      walletAddress: payload?.walletAddress,
      walletName: payload?.walletName ?? null,
      message,
    })

    const isValid = await verifyPersonalMessageSignature(messageBytes, payload.signature, {
      address: preparedLogin.walletAddress,
    })

    if (!isValid) {
      return json({ error: 'signature verification failed' }, { status: 401 })
    }

    const loginResult = await finalizeWalletLogin(sql, {
      challengeId: payload?.challengeId,
      walletAddress: payload?.walletAddress,
      walletName: payload?.walletName ?? null,
    })

    const { token, expiresAt } = signAccessToken({
      sub: loginResult.user.id,
      walletAddress: loginResult.user.walletAddress,
      chain: loginResult.user.chain,
    })
    const response = json({
      token,
      expiresAt,
      user: loginResult.user,
    })

    response.headers.append(
      'Set-Cookie',
      serializeCookie(ACCESS_TOKEN_COOKIE_NAME, token, {
        maxAge: getJwtTtlSeconds(),
        secure: requestUrl.protocol === 'https:',
      })
    )

    return response
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to authenticate wallet'
    let status = 500

    if (
      error instanceof Error &&
      [
        'walletAddress must be a valid Sui address',
        'bytes is required',
        'message does not match challenge',
      ].includes(error.message)
    ) {
      status = 400
    } else if (
      error instanceof Error &&
      [
        'challenge was not found',
        'challenge does not belong to walletAddress',
        'challenge has already been used',
        'challenge has expired',
        'challenge is no longer valid',
      ].includes(error.message)
    ) {
      status = 401
    }

    return json({ error: message }, { status })
  }
}
