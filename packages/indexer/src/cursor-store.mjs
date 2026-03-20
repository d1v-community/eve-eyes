import fs from 'node:fs/promises'
import path from 'node:path'

function createEmptyState(config) {
  return {
    version: 1,
    network: config.network,
    packageId: config.packageId,
    modules: {},
    updatedAt: null,
  }
}

export async function readState(config) {
  try {
    const content = await fs.readFile(config.stateFilePath, 'utf8')
    const parsed = JSON.parse(content)

    return {
      ...createEmptyState(config),
      ...parsed,
      modules: parsed?.modules ?? {},
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return createEmptyState(config)
    }

    throw error
  }
}

export function getModuleCursor(state, moduleName) {
  return state.modules[moduleName]?.eventCursor ?? null
}

export async function writeModuleCursor(config, state, moduleName, eventCursor) {
  const nextState = {
    ...state,
    modules: {
      ...state.modules,
      [moduleName]: {
        eventCursor,
      },
    },
    updatedAt: new Date().toISOString(),
  }

  await fs.mkdir(path.dirname(config.stateFilePath), { recursive: true })

  const tempFilePath = `${config.stateFilePath}.tmp`
  await fs.writeFile(tempFilePath, JSON.stringify(nextState, null, 2), 'utf8')
  await fs.rename(tempFilePath, config.stateFilePath)

  return nextState
}
