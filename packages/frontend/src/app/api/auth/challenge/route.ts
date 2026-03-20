import { getSqlClient } from '~~/server/db/client.mjs'
import { createWalletLoginChallenge } from '~~/server/auth/repository.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const origin = new URL(request.url).origin
    const challenge = await createWalletLoginChallenge(getSqlClient(), {
      walletAddress: payload?.walletAddress,
      origin,
    })

    return json({
      challenge: {
        id: challenge.id,
        walletAddress: challenge.walletAddress,
        chain: challenge.chain,
        nonce: challenge.nonce,
        message: challenge.message,
        expiresAt: challenge.expiresAt,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create login challenge'
    const status =
      error instanceof Error &&
      error.message === 'walletAddress must be a valid Sui address'
        ? 400
        : 500

    return json({ error: message }, { status })
  }
}
