ALTER TABLE transaction_blocks
ADD COLUMN IF NOT EXISTS transaction_time TIMESTAMPTZ;

UPDATE transaction_blocks
SET transaction_time = executed_at
WHERE transaction_time IS NULL
  AND executed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS transaction_blocks_transaction_time_idx
  ON transaction_blocks (transaction_time DESC);

ALTER TABLE suiscan_move_calls
ADD COLUMN IF NOT EXISTS transaction_time TIMESTAMPTZ;

UPDATE suiscan_move_calls AS smc
SET transaction_time = t.transaction_time
FROM transaction_blocks AS t
WHERE smc.transaction_time IS NULL
  AND t.digest = smc.tx_digest;

CREATE INDEX IF NOT EXISTS suiscan_move_calls_transaction_time_idx
  ON suiscan_move_calls (transaction_time DESC);
