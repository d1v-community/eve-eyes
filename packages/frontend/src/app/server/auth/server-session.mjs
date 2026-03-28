import { cookies } from 'next/headers'
import { ACCESS_TOKEN_COOKIE_NAME } from './cookies.mjs'
import { buildTokenUser, verifyAccessToken } from './jwt.mjs'
import { getSqlClient } from '../db/client.mjs'
import { findWalletUserByAddress } from '../users/repository.mjs'

export async function getServerSessionUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  try {
    const payload = verifyAccessToken(token)
    const tokenUser = buildTokenUser(payload.user)

    if (tokenUser) {
      return tokenUser
    }

    const user = await findWalletUserByAddress(
      getSqlClient(),
      payload.walletAddress ?? payload.sub
    )

    return user ?? null
  } catch {
    return null
  }
}
