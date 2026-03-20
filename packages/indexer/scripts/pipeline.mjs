import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { loadProjectEnv } from './load-env.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')

async function bootstrapEnv() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)
}

async function sendStartupNotification() {
  const webhook = process.env.notify_webhook?.trim()

  if (!webhook) {
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        msg_type: 'text',
        content: {
          text: `[eve-eyes] indexer pipeline started on ${process.env.HOSTNAME ?? 'unknown-host'}`,
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error('[pipeline] failed to send startup notification', {
        status: response.status,
        statusText: response.statusText,
      })
    }
  } catch (error) {
    console.error(
      '[pipeline] failed to send startup notification',
      error instanceof Error ? error.message : String(error)
    )
  } finally {
    clearTimeout(timeout)
  }
}

function startProcess(name, args, extraEnv = {}) {
  const child = spawn(process.execPath, args, {
    cwd: packageRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  })

  console.log(`[pipeline] started ${name}`, { pid: child.pid, args })
  return child
}

async function main() {
  await bootstrapEnv()
  await sendStartupNotification()

  const children = [
    {
      name: 'indexer',
      child: startProcess('indexer', ['./src/main.mjs']),
    },
    {
      name: 'watch-transaction-block-move-calls',
      child: startProcess('watch-transaction-block-move-calls', [
        './scripts/watch-transaction-block-move-calls.mjs',
      ]),
    },
  ]

  let shuttingDown = false

  const shutdown = (signal) => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    console.log(`[pipeline] received ${signal}, shutting down`)

    for (const { child } of children) {
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGTERM')
      }
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  await Promise.race(
    children.map(
      ({ name, child }) =>
        new Promise((resolve, reject) => {
          child.once('exit', (code, signal) => {
            if (shuttingDown) {
              resolve({ name, code, signal })
              return
            }

            reject(
              new Error(
                `${name} exited unexpectedly with code ${code ?? 'null'} and signal ${signal ?? 'null'}`
              )
            )
          })

          child.once('error', reject)
        })
    )
  )

  shutdown('child-exit')
}

main().catch((error) => {
  console.error(
    '[pipeline] fatal error',
    error instanceof Error ? error.stack ?? error.message : String(error)
  )
  process.exitCode = 1
})
