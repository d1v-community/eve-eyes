import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDirectory, '..')

function startProcess(name, args) {
  const child = spawn(process.execPath, args, {
    cwd: packageRoot,
    stdio: 'inherit',
    env: process.env,
  })

  console.log(`[pipeline] started ${name}`, { pid: child.pid, args })
  return child
}

async function main() {
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
