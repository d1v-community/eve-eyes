# Indexer Pipeline And Scripts

这份文档说明 `packages/indexer` 的执行链路，重点回答 3 个问题：

- `pnpm indexer:pipeline` 实际会启动哪些进程
- 这些进程会更新哪些数据库表
- `packages/indexer/scripts` 里的脚本分别做什么，以及如何运行

## 1. Pipeline 执行关系图

```text
pnpm indexer:pipeline
  -> packages/indexer/scripts/pipeline.mjs
     -> node ./src/main.mjs
        -> 写 transaction_blocks
        -> 同步 transaction_blocks.derived_records_synced_at
        -> 同步 transaction_blocks.user_activity_synced_at
        -> 写 character_identity
        -> 写 building_instances
        -> 写 killmail_records
        -> 写 user_activity_records
        -> 写 user_activity_participants
        -> resolvePendingKillmailRecords()
           -> 回填 killmail_records.{killer,victim,reported_by}_wallet_address
           -> 更新 killmail_records.resolution_status / resolution_error / resolved_at
     -> node ./scripts/watch-transaction-block-move-calls.mjs
        -> 检查 transaction_blocks.move_calls_synced_at 是否为空
        -> 有待处理数据时拉起
           -> node ./scripts/sync-transaction-block-move-calls.mjs
              -> 写 suiscan_move_calls
              -> 更新 transaction_blocks.move_calls_synced_at
     -> node ./scripts/watch-transaction-block-derived-records.mjs
        -> 检查 transaction_blocks.derived_records_synced_at 是否为空
        -> 有待处理数据时拉起
           -> node ./scripts/sync-transaction-block-derived-records.mjs
              -> 写 character_identity
              -> 写 building_instances
              -> 写 killmail_records
              -> 更新 transaction_blocks.derived_records_synced_at
              -> resolvePendingBuildingInstances()
                 -> 回填 building_instances.owner_character_object_id
                 -> 回填 building_instances.owner_character_item_id
                 -> 必要时补写 character_identity
              -> reconcileActiveBuildingInstances()
                 -> 更新 building_instances.status / is_active / last_reconciled_at
              -> resolvePendingKillmailRecords()
                 -> 回填 killmail_records.{killer,victim,reported_by}_wallet_address
                 -> 更新 killmail_records.resolution_status / resolution_error / resolved_at
     -> node ./scripts/watch-transaction-block-user-activities.mjs
        -> 检查 transaction_blocks.user_activity_synced_at 是否为空
        -> 有待处理数据时拉起
           -> node ./scripts/sync-transaction-block-user-activities.mjs
              -> 重建 user_activity_records
              -> 重建 user_activity_participants
              -> 更新 user_activity_participants.wallet_address / resolved_via
              -> 更新 user_activity_records.primary_wallet_address
              -> 更新 user_activity_records.primary_character_item_id
              -> 更新 user_activity_records.primary_character_object_id
              -> 更新 transaction_blocks.user_activity_synced_at
```

## 2. Pipeline 涉及的数据库表

`pipeline` 主链路会更新这些表：

- `transaction_blocks`
- `suiscan_move_calls`
- `character_identity`
- `building_instances`
- `killmail_records`
- `user_activity_records`
- `user_activity_participants`

`transaction_blocks` 上会被回写这些同步标记列：

- `move_calls_synced_at`
- `derived_records_synced_at`
- `user_activity_synced_at`

## 3. Pipeline 里的脚本说明

### `pipeline.mjs`

路径：

- [`packages/indexer/scripts/pipeline.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/pipeline.mjs)

作用：

- `pipeline` 总入口
- 加载环境变量
- 可选发送启动通知
- 并行启动 4 个长期进程：
  - `src/main.mjs`
  - `watch-transaction-block-move-calls.mjs`
  - `watch-transaction-block-derived-records.mjs`
  - `watch-transaction-block-user-activities.mjs`

运行方式：

```bash
pnpm indexer:pipeline
```

或者：

```bash
pnpm --filter indexer run pipeline
```

### `../src/main.mjs`

路径：

- [`packages/indexer/src/main.mjs`](/Users/apple/project/eve-eyes/packages/indexer/src/main.mjs)

作用：

- 主索引进程
- 订阅包相关交易，订阅失败时退化到 compensation polling
- 拉取完整 transaction block
- upsert 到 `transaction_blocks`
- 在当前版本里还会内联同步：
  - derived records
  - user activities
- 有字符身份或 killmail 变化时会额外执行 killmail resolve
- 启动时会跑数据库 migration

主要写入：

- `transaction_blocks`
- `character_identity`
- `building_instances`
- `killmail_records`
- `user_activity_records`
- `user_activity_participants`
- `transaction_blocks.derived_records_synced_at`
- `transaction_blocks.user_activity_synced_at`

运行方式：

```bash
pnpm indexer:start
```

单次模式：

```bash
pnpm indexer:once
```

### `watch-transaction-block-move-calls.mjs`

路径：

- [`packages/indexer/scripts/watch-transaction-block-move-calls.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/watch-transaction-block-move-calls.mjs)

作用：

- 定时扫描 `transaction_blocks`
- 查找 `move_calls_synced_at IS NULL` 的交易
- 启动 `sync-transaction-block-move-calls.mjs`
- 启动前会把数据库里已经存在 `suiscan_move_calls` 的 digest 直接标记为已同步

运行方式：

```bash
pnpm --filter indexer run db:watch:transaction-block-move-calls
```

直接传参：

```bash
node ./packages/indexer/scripts/watch-transaction-block-move-calls.mjs [limit] [concurrency]
```

默认参数：

- `limit=500`
- `concurrency=5`

### `sync-transaction-block-move-calls.mjs`

路径：

- [`packages/indexer/scripts/sync-transaction-block-move-calls.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/sync-transaction-block-move-calls.mjs)

作用：

- 从 `transaction_blocks` 读取待处理 digest
- 补拉链上 transaction block
- 提取 move calls
- 删除该 digest 旧的 `suiscan_move_calls`
- 重建该 digest 的 `suiscan_move_calls`
- 最后回写 `transaction_blocks.move_calls_synced_at`
- 启动时会跑 migration

主要写入：

- `suiscan_move_calls`
- `transaction_blocks.move_calls_synced_at`

运行方式：

```bash
pnpm --filter indexer run db:sync:transaction-block-move-calls
```

直接传参：

```bash
node ./packages/indexer/scripts/sync-transaction-block-move-calls.mjs [limit] [concurrency]
```

默认参数：

- `limit=500`
- `concurrency=5`

### `watch-transaction-block-derived-records.mjs`

路径：

- [`packages/indexer/scripts/watch-transaction-block-derived-records.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/watch-transaction-block-derived-records.mjs)

作用：

- 定时扫描 `transaction_blocks`
- 查找 `derived_records_synced_at IS NULL` 的交易
- 发现待处理数据时，拉起 `sync-transaction-block-derived-records.mjs`

运行方式：

```bash
pnpm --filter indexer run db:watch:derived-records
```

直接传参：

```bash
node ./packages/indexer/scripts/watch-transaction-block-derived-records.mjs [limit] [resolveLimit] [reconcileLimit] [concurrency] [checkIntervalMs]
```

默认参数：

- `limit=250`
- `resolveLimit=500`
- `reconcileLimit=100`
- `concurrency=4`
- `checkIntervalMs=15000`

### `sync-transaction-block-derived-records.mjs`

路径：

- [`packages/indexer/scripts/sync-transaction-block-derived-records.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/sync-transaction-block-derived-records.mjs)

作用：

- 从 `transaction_blocks` 读取待派生交易
- 解析 object changes / events / effects
- 生成并更新：
  - `character_identity`
  - `building_instances`
  - `killmail_records`
- 回写 `transaction_blocks.derived_records_synced_at`
- 额外做 3 类补偿处理：
  - `resolvePendingBuildingInstances()`
  - `reconcileActiveBuildingInstances()`
  - `resolvePendingKillmailRecords()`
- 启动时会跑 migration

主要写入：

- `character_identity`
- `building_instances`
- `killmail_records`
- `transaction_blocks.derived_records_synced_at`

运行方式：

```bash
pnpm --filter indexer run db:sync:derived-records
```

直接传参：

```bash
node ./packages/indexer/scripts/sync-transaction-block-derived-records.mjs [limit] [resolveLimit] [concurrency] [reconcileLimit]
```

默认参数：

- `limit=250`
- `resolveLimit=500`
- `concurrency=6`
- `reconcileLimit=100`

### `watch-transaction-block-user-activities.mjs`

路径：

- [`packages/indexer/scripts/watch-transaction-block-user-activities.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/watch-transaction-block-user-activities.mjs)

作用：

- 定时扫描 `transaction_blocks`
- 查找 `user_activity_synced_at IS NULL` 的交易
- 发现待处理数据时，拉起 `sync-transaction-block-user-activities.mjs`

运行方式：

```bash
pnpm --filter indexer run db:watch:user-activities
```

直接传参：

```bash
node ./packages/indexer/scripts/watch-transaction-block-user-activities.mjs [limit]
```

默认参数：

- `limit=250`

### `sync-transaction-block-user-activities.mjs`

路径：

- [`packages/indexer/scripts/sync-transaction-block-user-activities.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/sync-transaction-block-user-activities.mjs)

作用：

- 从 `transaction_blocks` 读取待处理交易
- 从 events 和 move calls 生成 activity 记录
- 删除该 digest 旧的 `user_activity_records`
- 重建 `user_activity_records`
- 重建 `user_activity_participants`
- 基于 `character_identity` 回填参与者钱包地址
- 回填 activity 主参与者字段
- 最后回写 `transaction_blocks.user_activity_synced_at`
- 启动时会跑 migration

主要写入：

- `user_activity_records`
- `user_activity_participants`
- `transaction_blocks.user_activity_synced_at`

运行方式：

```bash
pnpm --filter indexer run db:sync:user-activities
```

直接传参：

```bash
node ./packages/indexer/scripts/sync-transaction-block-user-activities.mjs [limit]
```

默认参数：

- `limit=250`

## 4. 其它 scripts 目录脚本

下面这些脚本不属于 `pipeline` 长期运行链路，但经常会和主链路一起使用。

### `backfill-package-transaction-blocks.mjs`

路径：

- [`packages/indexer/scripts/backfill-package-transaction-blocks.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/backfill-package-transaction-blocks.mjs)

作用：

- 回补历史 `transaction_blocks`
- 在当前实现里也会内联同步 derived records 和 user activities
- 适合历史补数

运行方式：

```bash
pnpm --filter indexer run backfill:package
```

烟雾测试：

```bash
pnpm --filter indexer run backfill:package:smoke
```

自定义参数示例：

```bash
pnpm --filter indexer run backfill:package -- --max-modules 2 --max-pages-per-module 1 --max-transactions 20
```

### `backfill-user-activities-until-empty.mjs`

路径：

- [`packages/indexer/scripts/backfill-user-activities-until-empty.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/backfill-user-activities-until-empty.mjs)

作用：

- 循环执行 user activity 同步
- 直到 `transaction_blocks.user_activity_synced_at IS NULL` 的待处理数据清空

运行方式：

```bash
pnpm --filter indexer run db:backfill:user-activities
```

### `sync-derived-records-for-digests.mjs`

路径：

- [`packages/indexer/scripts/sync-derived-records-for-digests.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/sync-derived-records-for-digests.mjs)

作用：

- 只对指定 digest 做 derived records 重算
- 适合修复单笔或少量交易

运行方式：

```bash
node ./packages/indexer/scripts/sync-derived-records-for-digests.mjs <digest...>
```

### `sync-user-activities-for-digests.mjs`

路径：

- [`packages/indexer/scripts/sync-user-activities-for-digests.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/sync-user-activities-for-digests.mjs)

作用：

- 只对指定 digest 做 user activities 重算
- 适合修复单笔或少量交易

运行方式：

```bash
node ./packages/indexer/scripts/sync-user-activities-for-digests.mjs <digest...>
```

### `find-failed-transactions-with-move-calls.mjs`

路径：

- [`packages/indexer/scripts/find-failed-transactions-with-move-calls.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/find-failed-transactions-with-move-calls.mjs)

作用：

- 查询数据库里失败但含 move calls 的交易
- 用于排查 move call 数据质量

运行方式：

```bash
pnpm --filter indexer run db:find:failed-move-calls
```

### `import-suiscan-csv.mjs`

路径：

- [`packages/indexer/scripts/import-suiscan-csv.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/import-suiscan-csv.mjs)

作用：

- 导入 Suiscan CSV 历史数据

运行方式：

```bash
pnpm --filter indexer run db:import:suiscan /path/to/file.csv
```

### `sync-suiscan-rpc.mjs`

路径：

- [`packages/indexer/scripts/sync-suiscan-rpc.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/sync-suiscan-rpc.mjs)

作用：

- 执行一次 Suiscan RPC 同步

运行方式：

```bash
pnpm --filter indexer run db:sync:suiscan-rpc
```

### `watch-sync-suiscan-rpc.mjs`

路径：

- [`packages/indexer/scripts/watch-sync-suiscan-rpc.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/watch-sync-suiscan-rpc.mjs)

作用：

- 周期性执行 Suiscan RPC 同步

运行方式：

```bash
pnpm --filter indexer run db:watch:suiscan-rpc
```

### `subscribe-package-transactions.mjs`

路径：

- [`packages/indexer/scripts/subscribe-package-transactions.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/subscribe-package-transactions.mjs)

作用：

- 旧的独立订阅脚本
- 更偏向通知/监听用途，不是当前主数据库 ingest 入口

运行方式：

```bash
pnpm --filter indexer run subscribe:package
```

### `load-env.mjs`

路径：

- [`packages/indexer/scripts/load-env.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/load-env.mjs)

作用：

- 工具脚本
- 负责加载 repo、package、frontend 侧环境变量
- 一般不单独运行，而是被其他脚本 import

### `sui-rpc-sync-helpers.mjs`

路径：

- [`packages/indexer/scripts/sui-rpc-sync-helpers.mjs`](/Users/apple/project/eve-eyes/packages/indexer/scripts/sui-rpc-sync-helpers.mjs)

作用：

- 工具脚本
- 提供 RPC pool、批量请求、并发执行、move call 提取、日志等公共能力
- 一般不单独运行，而是被其他脚本 import

## 5. 常用运行方式

### 全量实时链路

```bash
pnpm indexer:pipeline
```

适合场景：

- 你要一口气维护 `transaction_blocks`、`suiscan_move_calls`、derived records、user activities

### 只跑主索引

```bash
pnpm indexer:start
```

适合场景：

- 只需要持续写入 `transaction_blocks`
- 或者你打算把衍生同步拆到别的进程跑

### 只跑 move calls watcher

```bash
pnpm --filter indexer run db:watch:transaction-block-move-calls
```

### 只跑 derived records watcher

```bash
pnpm --filter indexer run db:watch:derived-records
```

### 只跑 user activities watcher

```bash
pnpm --filter indexer run db:watch:user-activities
```

### 一次性补数据

```bash
pnpm --filter indexer run db:sync:transaction-block-move-calls
pnpm --filter indexer run db:sync:derived-records
pnpm --filter indexer run db:sync:user-activities
```

## 6. 运行注意事项

- 不要同时运行多个 `pnpm indexer:start` 或多个 `pnpm indexer:pipeline`
- 原因是主索引 cursor 在本地 state file，不在数据库里
- `move calls`、`derived records`、`user activities` 这些 sync 脚本基本是可重入和幂等的，但正常情况下没必要多开
- `main.mjs` 和多个 `sync-*` 脚本启动时都会尝试跑 migration
