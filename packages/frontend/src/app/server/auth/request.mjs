import { ACCESS_TOKEN_COOKIE_NAME, parseCookies } from './cookies.mjs'
import { verifyAccessToken } from './jwt.mjs'
import {
  enforceApiKeyRateLimit,
  findApiKeyByValue,
  markApiKeyUsed,
} from './repository.mjs'
import { findWalletUserByAddress } from '../users/repository.mjs'

function getBearerToken(request) {
  const authorization = request.headers.get('authorization')

  if (!authorization) {
    return null
  }

  const [scheme, value] = authorization.trim().split(/\s+/, 2)

  if (!scheme || !value) {
    return null
  }

  if (scheme.toLowerCase() === 'bearer') {
    return value
  }

  if (scheme.toLowerCase() === 'apikey') {
    return { apiKey: value }
  }

  return null
}

export async function resolveRequestAuth(sql, request) {
  const bearerToken = getBearerToken(request)
  const xApiKey = request.headers.get('x-api-key')?.trim() ?? null

  if (xApiKey || (bearerToken && typeof bearerToken === 'object')) {
    const apiKeyValue = xApiKey ?? bearerToken.apiKey
    const apiKey = await findApiKeyByValue(sql, apiKeyValue)

    if (!apiKey || apiKey.revokedAt) {
      throw new Error('API key is invalid')
    }

    await enforceApiKeyRateLimit(sql, apiKey)
    await markApiKeyUsed(sql, apiKey.id)

    return {
      type: 'apiKey',
      apiKey,
      userId: apiKey.userId,
    }
  }

  const cookieToken =
    parseCookies(request.headers.get('cookie'))[ACCESS_TOKEN_COOKIE_NAME] ?? null
  const token =
    typeof bearerToken === 'string' && bearerToken.length > 0
      ? bearerToken
      : cookieToken

  if (!token) {
    return {
      type: 'anonymous',
      userId: null,
    }
  }

  const payload = verifyAccessToken(token)
  const user = await findWalletUserByAddress(sql, payload.walletAddress ?? payload.sub)

  if (!user) {
    throw new Error('JWT user was not found')
  }

  return {
    type: 'jwt',
    tokenPayload: payload,
    userId: user.id,
    user,
  }
}

export async function requireAuthenticatedRequest(sql, request) {
  const auth = await resolveRequestAuth(sql, request)

  if (auth.type === 'anonymous') {
    throw new Error('authentication is required')
  }

  return auth
}

export async function requireJwtRequest(sql, request) {
  const auth = await requireAuthenticatedRequest(sql, request)

  if (auth.type !== 'jwt') {
    throw new Error('JWT authentication is required')
  }

  return auth
}
