# Sui Testnet Indexer

Standalone Node.js worker that:

- polls Sui testnet for package-related events
- uses those events to discover candidate transactions
- fetches full transaction blocks
- upserts them into `transaction_blocks`
- stores sync progress in a local state file

## Run

From the repository root:

```bash
pnpm indexer:start
```

Run a single polling cycle:

```bash
pnpm indexer:once
```

## Optional env

- `SUI_INDEXER_PACKAGE_ID`
- `SUI_INDEXER_RPC_URL`
- `SUI_INDEXER_MODULES`
- `SUI_INDEXER_POLL_INTERVAL_MS`
- `SUI_INDEXER_EVENT_PAGE_SIZE`
- `SUI_INDEXER_DB_RETRY_COUNT`
- `SUI_INDEXER_DB_RETRY_DELAY_MS`
- `SUI_INDEXER_CYCLE_ERROR_DELAY_MS`
- `SUI_INDEXER_DIGEST_CACHE_LIMIT`
- `SUI_INDEXER_STATE_FILE`
