import crypto from 'node:crypto'
import { getAuthSecret, getJwtTtlSeconds } from './config.mjs'

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url')
}

function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function signSegment(segment) {
  return crypto
    .createHmac('sha256', getAuthSecret())
    .update(segment)
    .digest('base64url')
}

export function signAccessToken(payload, options = {}) {
  const now = Math.floor(Date.now() / 1000)
  const ttlSeconds = options.ttlSeconds ?? getJwtTtlSeconds()
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }
  const claims = {
    iss: 'eve-eyes',
    aud: 'eve-eyes-users',
    iat: now,
    exp: now + ttlSeconds,
    ...payload,
  }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(claims))
  const unsignedToken = `${encodedHeader}.${encodedPayload}`
  const signature = signSegment(unsignedToken)

  return {
    token: `${unsignedToken}.${signature}`,
    expiresAt: new Date((claims.exp ?? now) * 1000).toISOString(),
  }
}

export function verifyAccessToken(token) {
  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('token is required')
  }

  const parts = token.split('.')

  if (parts.length !== 3) {
    throw new Error('token format is invalid')
  }

  const [encodedHeader, encodedPayload, receivedSignature] = parts
  const unsignedToken = `${encodedHeader}.${encodedPayload}`
  const expectedSignature = signSegment(unsignedToken)

  if (
    receivedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(expectedSignature)
    )
  ) {
    throw new Error('token signature is invalid')
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader))
  const payload = JSON.parse(base64UrlDecode(encodedPayload))
  const now = Math.floor(Date.now() / 1000)

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('token header is invalid')
  }

  if (payload.iss !== 'eve-eyes' || payload.aud !== 'eve-eyes-users') {
    throw new Error('token audience is invalid')
  }

  if (typeof payload.exp !== 'number' || now >= payload.exp) {
    throw new Error('token has expired')
  }

  if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
    throw new Error('token subject is invalid')
  }

  return payload
}
