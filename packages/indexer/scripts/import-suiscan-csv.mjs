import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from './load-env.mjs'
import { createSqlClient } from '../../frontend/src/app/server/db/client.mjs'
import { runPendingMigrations } from '../../frontend/src/app/server/db/migrations.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')
const frontendRoot = path.join(repoRoot, 'packages', 'frontend')
const migrationsDirectory = path.join(frontendRoot, 'db', 'migrations')
const defaultCsvPath = path.join(repoRoot, '..', 'suiscan.cleaned.csv')

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }

      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function parseSuiscanUrl(sourceUrl) {
  const url = new URL(sourceUrl)
  const segments = url.pathname.split('/').filter(Boolean)

  if (url.hostname !== 'suiscan.xyz') {
    throw new Error(`Unsupported hostname: ${url.hostname}`)
  }

  if (segments.length < 3) {
    throw new Error(`Unsupported suiscan path: ${url.pathname}`)
  }

  const [network, recordType, identifier] = segments

  if (!network) {
    throw new Error(`Missing network in url: ${sourceUrl}`)
  }

  if (!identifier) {
    throw new Error(`Missing identifier in url: ${sourceUrl}`)
  }

  if (recordType === 'tx') {
    return {
      network,
      recordType: 'tx',
      txDigest: identifier,
      accountAddress: null,
    }
  }

  if (recordType === 'account') {
    return {
      network,
      recordType: 'account',
      txDigest: null,
      accountAddress: identifier?.toLowerCase() ?? null,
    }
  }

  throw new Error(`Unsupported suiscan record type: ${recordType}`)
}

async function readCsvRecords(csvPath) {
  const content = await fs.readFile(csvPath, 'utf8')
  const lines = content.split(/\r?\n/).filter(Boolean)

  if (lines.length <= 1) {
    return []
  }

  return lines.slice(1).map((line, index) => {
    const [sourceUrl = '', shortPrefix = '', shortSuffix = ''] = parseCsvLine(line)

    if (!sourceUrl) {
      throw new Error(`Missing source_url at csv line ${index + 2}`)
    }

    const parsed = parseSuiscanUrl(sourceUrl)

    return {
      sourceUrl,
      recordType: parsed.recordType,
      network: parsed.network ?? null,
      txDigest: parsed.txDigest ?? null,
      accountAddress: parsed.accountAddress ?? null,
      shortPrefix: shortPrefix || null,
      shortSuffix: shortSuffix || null,
    }
  })
}

function dedupeRecords(records) {
  const bySourceUrl = new Map()

  for (const record of records) {
    bySourceUrl.set(record.sourceUrl, record)
  }

  return {
    records: [...bySourceUrl.values()],
    duplicateCount: records.length - bySourceUrl.size,
  }
}

async function importRecords(sql, records) {
  let insertedCount = 0
  let updatedCount = 0
  const chunkSize = 500

  for (let index = 0; index < records.length; index += chunkSize) {
    const chunk = records.slice(index, index + chunkSize)
    const values = []
    const placeholders = chunk.map((record, rowIndex) => {
      const offset = rowIndex * 7
      values.push(
        record.sourceUrl,
        record.recordType,
        record.network,
        record.txDigest,
        record.accountAddress,
        record.shortPrefix,
        record.shortSuffix
      )

      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
    })

    const rows = await sql.unsafe(
      `
      INSERT INTO suiscan_records (
        source_url,
        record_type,
        network,
        tx_digest,
        account_address,
        short_prefix,
        short_suffix
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (source_url)
      DO UPDATE SET
        record_type = EXCLUDED.record_type,
        network = EXCLUDED.network,
        tx_digest = EXCLUDED.tx_digest,
        account_address = EXCLUDED.account_address,
        short_prefix = EXCLUDED.short_prefix,
        short_suffix = EXCLUDED.short_suffix
      RETURNING (xmax = 0) AS inserted
      `,
      values
    )

    for (const row of rows) {
      if (row.inserted) {
        insertedCount += 1
      } else {
        updatedCount += 1
      }
    }
  }

  return {
    insertedCount,
    updatedCount,
  }
}

async function main() {
  await loadProjectEnv(repoRoot)
  await loadProjectEnv(packageRoot)
  await loadProjectEnv(frontendRoot)

  const csvPathArgument = process.argv[2]
  const csvPath = path.resolve(
    process.cwd(),
    csvPathArgument && csvPathArgument.length > 0 ? csvPathArgument : defaultCsvPath
  )

  const sql = createSqlClient()

  try {
    await runPendingMigrations(sql, migrationsDirectory)

    const parsedRecords = await readCsvRecords(csvPath)
    const { records, duplicateCount } = dedupeRecords(parsedRecords)
    const result = await importRecords(sql, records)

    console.log(`csv: ${csvPath}`)
    console.log(`processed: ${parsedRecords.length}`)
    console.log(`deduplicated: ${duplicateCount}`)
    console.log(`imported_candidates: ${records.length}`)
    console.log(`inserted: ${result.insertedCount}`)
    console.log(`updated: ${result.updatedCount}`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.stack ?? error.message : String(error)
  )
  process.exitCode = 1
})
