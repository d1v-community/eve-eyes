import { ACCESS_TOKEN_COOKIE_NAME, serializeCookie } from '~~/server/auth/cookies.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init)
}

export async function POST(request: Request) {
  const response = json({ ok: true })
  const requestUrl = new URL(request.url)

  response.headers.append(
    'Set-Cookie',
    serializeCookie(ACCESS_TOKEN_COOKIE_NAME, '', {
      maxAge: 0,
      secure: requestUrl.protocol === 'https:',
    })
  )

  return response
}
