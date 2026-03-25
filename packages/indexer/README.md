# Sui Testnet Indexer

Standalone Node.js worker that:

- polls Sui testnet for package-related events
- uses those events to discover candidate transactions
- fetches full transaction blocks
- upserts them into `transaction_blocks`
- marks move-call sync completion in `transaction_blocks.move_calls_synced_at`
- stores sync progress in a local state file

## What To Run

If you need to continuously:

- ingest the latest on-chain package-related transactions into `transaction_blocks`
- parse newly stored transactions into Move calls in `suiscan_move_calls`

run:

```bash
pnpm indexer:pipeline
```

This starts three long-running processes:

- `packages/indexer/src/main.mjs`: package transaction listener with polling fallback, `transaction_blocks` writer, and optional webhook notification sender
- `packages/indexer/scripts/watch-transaction-block-move-calls.mjs`: move-call sync watcher
- `packages/indexer/scripts/watch-transaction-block-derived-records.mjs`: character-history + killmail-resolution watcher

If you prefer to run them separately, use two terminals:

```bash
pnpm indexer:start
```

```bash
pnpm --filter indexer run db:watch:transaction-block-move-calls
```

Key command behavior:

- `pnpm --filter indexer subscribe:package`
  - Legacy standalone webhook notifier. Keep it only if you intentionally want notifications without running the main DB ingester.
- `pnpm --filter indexer backfill:package`
  - Backfills missing `transaction_blocks` rows and writes `transaction_time` into `transaction_blocks`.
- `pnpm --filter indexer run db:watch:transaction-block-move-calls`
  - Periodically parses pending successful transactions and writes `transaction_time` into `suiscan_move_calls`.
- `pnpm --filter indexer run db:watch:derived-records`
  - Periodically derives `character_identity` history and `killmail_records` from indexed `transaction_blocks`.

## Other Commands

From the repository root:

```bash
pnpm indexer:start
```

Run the live ingest + move-call sync pipeline:

```bash
pnpm indexer:pipeline
```

Run a single polling cycle:

```bash
pnpm indexer:once
```

Run a one-off move-call backfill from existing `transaction_blocks` rows:

```bash
pnpm --filter indexer run db:sync:transaction-block-move-calls
```

Import historical Suiscan CSV data:

```bash
pnpm --filter indexer run db:import:suiscan /path/to/file.csv
```

## Idempotency And Concurrency

- `transaction_blocks` is protected by a unique index on `(network, digest)`, and the indexer uses `ON CONFLICT DO UPDATE`, so reruns do not create duplicate rows.
- `suiscan_move_calls` is protected by a unique index on `(tx_digest, call_index)`.
- Both `transaction_blocks` and `suiscan_move_calls` store `transaction_time` so downstream queries can read transaction timestamps directly.
- Move-call sync marks completion in `transaction_blocks.move_calls_synced_at`, so transactions with zero Move calls are still treated as processed and are not retried forever.
- Move-call sync also uses a PostgreSQL advisory lock per digest, so concurrent sync workers do not process the same digest at the same time.

## Important Operational Note

- Run only one `indexer:start` or `indexer:pipeline` instance at a time.
- Reason: the main indexer cursor is stored in a local state file, not in the database, so multiple main indexer processes can overwrite each other's cursor progress.
- Running an extra move-call sync worker is much safer than running an extra main indexer, but still unnecessary in normal operation.

## Optional env

- `SUI_INDEXER_PACKAGE_ID`
- `SUI_INDEXER_RPC_URL`
- `SUI_INDEXER_MODULES`
- `SUI_INDEXER_POLL_INTERVAL_MS`
- `SUI_INDEXER_EVENT_PAGE_SIZE`
- `SUI_INDEXER_DB_RETRY_COUNT`
- `SUI_INDEXER_DB_RETRY_DELAY_MS`
- `SUI_INDEXER_RPC_RETRY_COUNT`
- `SUI_INDEXER_RPC_RETRY_DELAY_MS`
- `SUI_INDEXER_RPC_RETRY_MAX_DELAY_MS`
- `SUI_INDEXER_RPC_BATCH_SIZE`
- `SUI_INDEXER_PROCESS_CONCURRENCY`
- `SUI_INDEXER_CYCLE_ERROR_DELAY_MS`
- `SUI_INDEXER_DIGEST_CACHE_LIMIT`
- `SUI_INDEXER_STATE_FILE`
- `SUI_INDEXER_INITIAL_CURSOR_MODE` (`latest` by default, `earliest` for full historical replay)
- `SUI_INDEXER_COMPENSATION_POLL_INTERVAL_MS`
- `SUI_INDEXER_COMPENSATION_STATE_FILE`
- `notify_webhook` / `NOTIFY_WEBHOOK` (optional webhook URL used by `src/main.mjs`)
