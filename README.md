# EVE EYES

EVE EYES is an open-source on-chain intelligence console for the EVE Frontier ecosystem. It turns raw Sui testnet activity into a usable product surface: searchable records, route and world exploration, wallet-aware access, and API-ready datasets for builders, players, and competition teams.

[Live Product](https://eve-eyes.d0v.xyz/)

[中文版本](./README.zh-CN.md)

## Overview

Most on-chain game data is technically public but practically hard to use. Transactions are noisy, object state is fragmented, and explorers are optimized for inspection rather than product workflows.

EVE EYES solves that gap by combining three layers in one system:

- a player-facing interface for exploring world and chain activity
- an indexer pipeline that turns raw transaction blocks into structured records
- an API layer that lets downstream tools reuse the indexed data directly

The result is a project that is useful both as a standalone product and as infrastructure for other builders.

## Live Product

- Website: [https://eve-eyes.d0v.xyz/](https://eve-eyes.d0v.xyz/)
- Current focus: indexed transaction data, Move-call views, world exploration, wallet login, API access, and derived gameplay records such as building and killmail data

## Core Capabilities

- Index package-related Sui transaction blocks into PostgreSQL
- Parse and expose Move-call activity for downstream analysis
- Derive higher-level gameplay records from on-chain state changes
- Provide wallet-based authentication and API key management
- Offer a reusable API surface for dashboards, automation, and competition builds

## Architecture

The repository is organized as a small product stack rather than a single app:

- `packages/frontend`
  - Next.js application
  - UI, API routes, auth flows, and database-backed query layer
- `packages/indexer`
  - long-running Node.js workers
  - raw transaction ingestion, move-call parsing, and derived-record processing
- `packages/backend`
  - Move-related package scaffolding retained from earlier project setup

At a high level, the data flow looks like this:

1. `main.mjs` ingests package-related transactions into `transaction_blocks`
2. watcher scripts derive business tables such as `suiscan_move_calls`, `character_identity`, `killmail_records`, and `building_instances`
3. the frontend exposes these datasets through UI pages and HTTP APIs

## What Makes It Production-Shaped

- Clear separation between raw facts and derived tables
- Idempotent indexing and replay-friendly sync jobs
- Public and authenticated API surfaces in the frontend app
- Wallet login and API key flows for external reuse
- Live deployment alongside an open-source codebase

This is not only a visual demo. It is an operational data product with an ingest layer, derived storage, query APIs, and a user-facing client.

## Running Locally

From the repository root:

```bash
pnpm install
pnpm dev
```

For indexer-specific runtime details, see [packages/indexer/README.md](./packages/indexer/README.md).

## Operating The Indexer

If you want the indexed data to keep updating in real time, raw ingest alone is not enough. The main ingester writes to `transaction_blocks`, but derived tables require watcher processes.

In practice:

- keep `packages/indexer/src/main.mjs` running for raw transaction ingestion
- run `db:watch:derived-records` for derived tables such as building, character, and killmail data
- run `db:watch:transaction-block-move-calls` only if you also need `suiscan_move_calls` to stay current

The full operational notes are documented in [packages/indexer/README.md](./packages/indexer/README.md).

## Open Source

This repository currently keeps the simple model:

- source code: [MIT](./LICENSE)
- graphics and related visual assets: [LICENSE-GRAPHICS](./LICENSE-GRAPHICS)

That means the open-source version stays straightforward and broadly reusable. If the project later needs a commercial or open-core model, that can be introduced separately, but the current repository remains under its existing licenses.

## Use Cases

- Game-data dashboards
- Hackathon submissions
- Route, system, or world intelligence tools
- Chain activity research
- Community-built products that need an indexed EVE Frontier data layer

## Status

EVE EYES is an actively evolving open-source project with a live deployment, a working ingest pipeline, and an expanding set of derived data products.

