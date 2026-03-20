export const ACCESS_TOKEN_COOKIE_NAME = 'eve_eyes_access_token'

export function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`]

  segments.push(`Path=${options.path ?? '/'}`)

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${options.maxAge}`)
  }

  if (options.httpOnly !== false) {
    segments.push('HttpOnly')
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`)
  } else {
    segments.push('SameSite=Lax')
  }

  if (options.secure !== false) {
    segments.push('Secure')
  }

  return segments.join('; ')
}

export function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {}
  }

  return cookieHeader.split(';').reduce((accumulator, segment) => {
    const [name, ...rest] = segment.trim().split('=')

    if (!name) {
      return accumulator
    }

    accumulator[name] = decodeURIComponent(rest.join('='))
    return accumulator
  }, {})
}
