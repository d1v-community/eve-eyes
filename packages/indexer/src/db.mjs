import { setTimeout as delay } from 'node:timers/promises'

function isRetryableDatabaseError(error) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  return (
    message.includes('etimedout') ||
    message.includes('timed out') ||
    message.includes('connection terminated') ||
    message.includes('connection closed') ||
    message.includes('socket hang up') ||
    message.includes('read econnreset') ||
    message.includes('write epipe')
  )
}

async function executeUpsert(sql, record) {
  await sql`
    INSERT INTO transaction_blocks (
      digest,
      network,
      checkpoint,
      sender_address,
      transaction_kind,
      status,
      error_message,
      executed_at,
      transaction_time,
      raw_content,
      effects,
      events,
      object_changes,
      balance_changes,
      updated_at
    )
    VALUES (
      ${record.digest},
      ${record.network},
      ${record.checkpoint},
      ${record.senderAddress},
      ${record.transactionKind},
      ${record.status},
      ${record.errorMessage},
      ${record.executedAt},
      ${record.transactionTime},
      ${sql.json(record.rawContent)},
      ${sql.json(record.effects)},
      ${sql.json(record.events)},
      ${sql.json(record.objectChanges)},
      ${sql.json(record.balanceChanges)},
      NOW()
    )
    ON CONFLICT (network, digest)
    DO UPDATE SET
      checkpoint = EXCLUDED.checkpoint,
      sender_address = EXCLUDED.sender_address,
      transaction_kind = EXCLUDED.transaction_kind,
      status = EXCLUDED.status,
      error_message = EXCLUDED.error_message,
      executed_at = EXCLUDED.executed_at,
      transaction_time = EXCLUDED.transaction_time,
      raw_content = EXCLUDED.raw_content,
      effects = EXCLUDED.effects,
      events = EXCLUDED.events,
      object_changes = EXCLUDED.object_changes,
      balance_changes = EXCLUDED.balance_changes,
      updated_at = NOW()
  `
}

export async function upsertTransactionBlock(sql, record, config, logger) {
  let attempt = 0

  while (attempt < config.dbRetryCount) {
    attempt += 1

    try {
      await executeUpsert(sql, record)
      return
    } catch (error) {
      const shouldRetry =
        attempt < config.dbRetryCount && isRetryableDatabaseError(error)

      if (!shouldRetry) {
        throw error
      }

      logger.info('database upsert failed, retrying', {
        digest: record.digest,
        attempt,
        dbRetryCount: config.dbRetryCount,
        message: error instanceof Error ? error.message : String(error),
      })

      await delay(config.dbRetryDelayMs)
    }
  }
}
