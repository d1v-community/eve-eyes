export function createLogger(scope) {
  return {
    info(message, details) {
      if (details === undefined) {
        console.log(`[${scope}] ${message}`)
        return
      }

      console.log(`[${scope}] ${message}`, details)
    },
    error(message, error) {
      console.error(
        `[${scope}] ${message}`,
        error instanceof Error ? error.stack ?? error.message : error
      )
    },
  }
}
