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

function decodeBase64(value: string) {
  return Uint8Array.from(Buffer.from(value, 'base64'))
}

async function loadSuiSignatureTools() {
  const [
    cryptography,
    ed25519,
    secp256k1,
    secp256r1,
    verify,
  ] = await Promise.all([
    import('@mysten/sui/cryptography'),
    import('@mysten/sui/keypairs/ed25519'),
    import('@mysten/sui/keypairs/secp256k1'),
    import('@mysten/sui/keypairs/secp256r1'),
    import('@mysten/sui/verify'),
  ])

  return {
    parseSerializedSignature: cryptography.parseSerializedSignature,
    toSerializedSignature: cryptography.toSerializedSignature,
    Ed25519PublicKey: ed25519.Ed25519PublicKey,
    Secp256k1PublicKey: secp256k1.Secp256k1PublicKey,
    Secp256r1PublicKey: secp256r1.Secp256r1PublicKey,
    verifyPersonalMessageSignature: verify.verifyPersonalMessageSignature,
  }
}

type SuiSignatureTools = Awaited<ReturnType<typeof loadSuiSignatureTools>>

async function inferSerializedSignature(
  signatureTools: SuiSignatureTools,
  signature: string,
  publicKey: string | null,
  walletAddress: string
) {
  const {
    parseSerializedSignature,
    toSerializedSignature,
    Ed25519PublicKey,
    Secp256k1PublicKey,
    Secp256r1PublicKey,
  } = signatureTools
  const normalizedSignature = signature.trim()

  try {
    parseSerializedSignature(normalizedSignature)
    return normalizedSignature
  } catch {
    if (!publicKey) {
      throw new Error('signature could not be parsed')
    }
  }

  const signatureBytes = decodeBase64(normalizedSignature)
  const publicKeyBytes = decodeBase64(publicKey)
  const normalizedAddress = walletAddress.toLowerCase()
  try {
    const ed25519PublicKey = new Ed25519PublicKey(publicKeyBytes)

    if (ed25519PublicKey.toSuiAddress() === normalizedAddress) {
      return toSerializedSignature({
        signature: signatureBytes,
        signatureScheme: 'ED25519',
        publicKey: ed25519PublicKey,
      })
    }
  } catch {
    // Fall through to the secp256k1 / secp256r1 probes below.
  }

  for (const [signatureScheme, PublicKey] of [
    ['Secp256k1', Secp256k1PublicKey],
    ['Secp256r1', Secp256r1PublicKey],
  ] as const) {
    try {
      const candidatePublicKey = new PublicKey(publicKeyBytes)

      if (candidatePublicKey.toSuiAddress() === normalizedAddress) {
        return toSerializedSignature({
          signature: signatureBytes,
          signatureScheme,
          publicKey: candidatePublicKey,
        })
      }
    } catch {
      continue
    }
  }

  throw new Error('signature could not be parsed')
}

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const payload = await request.json()

    if (typeof payload?.signature !== 'string' || payload.signature.trim().length === 0) {
      return json({ error: 'signature is required' }, { status: 400 })
    }

    const sql = getSqlClient()
    const preparedLogin = await assertWalletLoginChallenge(sql, {
      challengeId: payload?.challengeId,
      walletAddress: payload?.walletAddress,
      walletName: payload?.walletName ?? null,
    })
    const messageBytes = new TextEncoder().encode(preparedLogin.challenge.message)
    const signatureTools = await loadSuiSignatureTools()
    const signature = await inferSerializedSignature(
      signatureTools,
      payload.signature,
      typeof payload?.publicKey === 'string' ? payload.publicKey.trim() : null,
      preparedLogin.walletAddress
    )
    const { verifyPersonalMessageSignature } = signatureTools

    const isValid = await verifyPersonalMessageSignature(messageBytes, signature, {
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
      user: loginResult.user,
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
        'message does not match challenge',
        'signature could not be parsed',
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
