import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectEnv } from '../scripts/load-env.mjs'
import { createSqlClient } from '../src/app/server/db/client.mjs'
import { runPendingMigrations } from '../src/app/server/db/migrations.mjs'
import { listUserActivities } from '../src/app/server/indexer/user-activity-repository.mjs'
import { syncUserActivityRecordsForTransactionBlock } from '../../indexer/src/user-activity-sync.mjs'
import { processTransactionBlock } from '../../indexer/src/ingest.mjs'

const PACKAGE_ID =
  '0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75'
const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
await loadProjectEnv(projectRoot)

const databaseUrl = process.env.DATABASE_URL
const migrationsDirectory = path.join(projectRoot, 'db', 'migrations')

test('syncUserActivityRecordsForTransactionBlock resolves participants and lists activities by wallet', async (t) => {
  if (!databaseUrl) {
    t.skip('DATABASE_URL is not configured')
    return
  }

  const sql = createSqlClient(databaseUrl)
  const digest = `test-user-activity-${crypto.randomBytes(8).toString('hex')}`
  const walletAddress = `0x${crypto.randomBytes(32).toString('hex')}`
  const characterObjectId = `0x${crypto.randomBytes(32).toString('hex')}`
  const characterItemId = String(
    BigInt(`0x${crypto.randomBytes(6).toString('hex')}`)
  )
  const activityTime = '2026-03-25T13:10:18.113Z'

  await runPendingMigrations(sql, migrationsDirectory)

  try {
    await sql`
      INSERT INTO transaction_blocks (
        digest,
        network,
        transaction_time,
        raw_content,
        events,
        created_at,
        updated_at
      )
      VALUES (
        ${digest},
        'sui',
        ${activityTime},
        ${sql.json({
          events: [
            {
              id: { txDigest: digest, eventSeq: '0' },
              type: `${PACKAGE_ID}::world::JumpEvent`,
              parsedJson: {
                character_id: characterObjectId,
                source_gate_id:
                  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                destination_gate_id:
                  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
              },
            },
          ],
          transaction: {
            data: {
              transaction: {
                transactions: [],
                inputs: [],
              },
            },
          },
        })},
        ${sql.json([
          {
            id: { txDigest: digest, eventSeq: '0' },
            type: `${PACKAGE_ID}::world::JumpEvent`,
            parsedJson: {
              character_id: characterObjectId,
              source_gate_id:
                '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              destination_gate_id:
                '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            },
          },
        ])},
        NOW(),
        NOW()
      )
    `

    await sql`
      INSERT INTO character_identity (
        tenant,
        character_item_id,
        character_object_id,
        character_address,
        source_tx_digest,
        source_tx_timestamp,
        source_object_version,
        valid_from,
        valid_to,
        is_current,
        created_at,
        updated_at
      )
      VALUES (
        'utopia',
        ${characterItemId},
        ${characterObjectId},
        ${walletAddress.toLowerCase()},
        'seed-digest',
        '2026-03-24T00:00:00.000Z',
        '1',
        '2026-03-24T00:00:00.000Z',
        NULL,
        TRUE,
        NOW(),
        NOW()
      )
    `

    const rows = await sql`
      SELECT
        digest,
        transaction_time,
        raw_content,
        events,
        created_at
      FROM transaction_blocks
      WHERE digest = ${digest}
      LIMIT 1
    `

    const result = await syncUserActivityRecordsForTransactionBlock(
      sql,
      PACKAGE_ID,
      rows[0]
    )

    assert.equal(result.skipped, false)
    assert.equal(result.activityCount, 1)

    const listing = await listUserActivities(sql, {
      filters: {
        address: null,
        walletAddress,
        objectId: null,
        tenant: null,
        activityType: null,
        moduleName: null,
        functionName: null,
        sourceKind: null,
        txDigest: null,
        eventSeq: null,
        callIndex: null,
        from: null,
        to: null,
      },
      pageSize: 10,
      offset: 0,
    })

    assert.equal(listing.total, 1)
    assert.equal(listing.items[0]?.txDigest, digest)
    assert.equal(listing.items[0]?.walletAddress, walletAddress.toLowerCase())
    assert.equal(listing.items[0]?.activityType, 'jump')
    assert.equal(listing.items[0]?.participants[0]?.walletAddress, walletAddress.toLowerCase())

    const addressListing = await listUserActivities(sql, {
      filters: {
        address: walletAddress,
        walletAddress: null,
        objectId: null,
        tenant: null,
        activityType: null,
        moduleName: null,
        functionName: null,
        sourceKind: null,
        txDigest: null,
        eventSeq: null,
        callIndex: null,
        from: null,
        to: null,
      },
      pageSize: 10,
      offset: 0,
    })

    assert.equal(addressListing.total, 1)

    const objectListing = await listUserActivities(sql, {
      filters: {
        address: characterObjectId,
        walletAddress: null,
        objectId: null,
        tenant: null,
        activityType: null,
        moduleName: null,
        functionName: null,
        sourceKind: null,
        txDigest: null,
        eventSeq: null,
        callIndex: null,
        from: null,
        to: null,
      },
      pageSize: 10,
      offset: 0,
    })

    assert.equal(objectListing.total, 1)
  } finally {
    await sql`DELETE FROM transaction_blocks WHERE digest = ${digest}`
    await sql`DELETE FROM character_identity WHERE character_object_id = ${characterObjectId}`
    await sql.end({ timeout: 5 })
  }
})

test('processTransactionBlock can sync user activities inline during ingest', async (t) => {
  if (!databaseUrl) {
    t.skip('DATABASE_URL is not configured')
    return
  }

  const sql = createSqlClient(databaseUrl)
  const digest = `test-inline-user-activity-${crypto.randomBytes(8).toString('hex')}`
  const walletAddress = `0x${crypto.randomBytes(32).toString('hex')}`.toLowerCase()
  const activityTime = '2026-03-26T08:10:18.113Z'

  await runPendingMigrations(sql, migrationsDirectory)

  try {
    const txBlock = {
      digest,
      checkpoint: '12345',
      timestampMs: String(Date.parse(activityTime)),
      transaction: {
        data: {
          sender:
            '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          transaction: {
            transactions: [],
          },
        },
      },
      effects: {
        status: {
          status: 'success',
          error: null,
        },
      },
      events: [
        {
          id: { txDigest: digest, eventSeq: '0' },
          type: `${PACKAGE_ID}::character::CharacterCreatedEvent`,
          sender:
            '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          parsedJson: {
            key: {
              tenant: 'utopia',
              item_id: '2112000999',
            },
            character_id:
              '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            character_address: walletAddress,
          },
        },
      ],
      objectChanges: [
        {
          type: 'created',
          objectType: `${PACKAGE_ID}::character::Character`,
          objectId:
            '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          version: '7',
        },
      ],
      effects: {
        status: {
          status: 'success',
          error: null,
        },
        created: [
          {
            owner: {
              Shared: {
                initial_shared_version: 7,
              },
            },
            reference: {
              objectId:
                '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
              version: '7',
            },
          },
        ],
      },
      balanceChanges: [],
    }

    const result = await processTransactionBlock(
      sql,
      {
        packageId: PACKAGE_ID,
        network: 'sui',
        dbRetryCount: 1,
        dbRetryDelayMs: 0,
      },
      txBlock,
      {
        info() {},
        error() {},
      },
      {
        rpcPool: null,
        syncDerivedRecords: true,
        syncUserActivities: true,
      }
    )

    assert.equal(result.stored, true)
    assert.equal(result.derivedSynced, true)
    assert.equal(result.characterChangeCount, 1)
    assert.equal(result.activitySynced, true)
    assert.equal(result.activityCount, 1)

    const listing = await listUserActivities(sql, {
      filters: {
        address: walletAddress,
        walletAddress: null,
        objectId: null,
        tenant: null,
        activityType: null,
        moduleName: null,
        functionName: null,
        sourceKind: null,
        txDigest: null,
        eventSeq: null,
        callIndex: null,
        from: null,
        to: null,
      },
      pageSize: 10,
      offset: 0,
    })

    assert.equal(listing.total, 1)
    assert.equal(listing.items[0]?.txDigest, digest)

    const rows = await sql`
      SELECT user_activity_synced_at
      FROM transaction_blocks
      WHERE digest = ${digest}
      LIMIT 1
    `

    assert.ok(rows[0]?.user_activity_synced_at)

    const derivedRows = await sql`
      SELECT derived_records_synced_at
      FROM transaction_blocks
      WHERE digest = ${digest}
      LIMIT 1
    `

    assert.ok(derivedRows[0]?.derived_records_synced_at)

    const identityRows = await sql`
      SELECT tenant, character_item_id, character_object_id, character_address
      FROM character_identity
      WHERE source_tx_digest = ${digest}
    `

    assert.equal(identityRows.length, 1)
    assert.equal(identityRows[0]?.tenant, 'utopia')
    assert.equal(identityRows[0]?.character_item_id, '2112000999')
    assert.equal(identityRows[0]?.character_address, walletAddress)
  } finally {
    await sql`DELETE FROM transaction_blocks WHERE digest = ${digest}`
    await sql`DELETE FROM character_identity WHERE source_tx_digest = ${digest}`
    await sql.end({ timeout: 5 })
  }
})
