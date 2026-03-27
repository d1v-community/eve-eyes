export const ROUTE_NOT_FOUND_MESSAGE =
  'No route found within the current search budget'

export const ROUTE_SERVICE_UNAVAILABLE_MESSAGE =
  'Atlas routing service is temporarily unavailable. Try again shortly.'

const UPSTREAM_ROUTE_UNAVAILABLE_PATTERN = /^(502|503|504)\b/

export function normalizeRouteErrorMessage(message?: string | null) {
  const normalized = message?.trim() ?? ''

  if (!normalized) {
    return 'Route search failed'
  }

  if (UPSTREAM_ROUTE_UNAVAILABLE_PATTERN.test(normalized)) {
    return ROUTE_SERVICE_UNAVAILABLE_MESSAGE
  }

  return normalized
}

export function getRouteErrorStatus(message?: string | null) {
  const normalized = message?.trim() ?? ''

  if (!normalized) {
    return 500
  }

  if (normalized === 'originId and destinationId are required numbers') {
    return 400
  }

  if (
    normalized === 'Origin or destination not found' ||
    normalized === ROUTE_NOT_FOUND_MESSAGE
  ) {
    return 404
  }

  if (UPSTREAM_ROUTE_UNAVAILABLE_PATTERN.test(normalized)) {
    return 503
  }

  return 500
}
