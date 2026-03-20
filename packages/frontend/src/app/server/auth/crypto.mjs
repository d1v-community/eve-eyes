import crypto from 'node:crypto'
import { getAuthSecret } from './config.mjs'

export function generateOpaqueId(size = 16) {
  return crypto.randomBytes(size).toString('hex')
}

export function generateNonce(size = 24) {
  return crypto.randomBytes(size).toString('base64url')
}

export function hashApiKey(apiKey) {
  return crypto
    .createHmac('sha256', getAuthSecret())
    .update(apiKey)
    .digest('hex')
}

export function createApiKeyValue() {
  const secret = crypto.randomBytes(32).toString('base64url')
  return `eve_ak_${secret}`
}

export function getApiKeyPrefix(apiKey) {
  return apiKey.slice(0, 18)
}
