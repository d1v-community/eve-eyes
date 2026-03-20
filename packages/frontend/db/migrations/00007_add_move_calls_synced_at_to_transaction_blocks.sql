ALTER TABLE transaction_blocks
ADD COLUMN IF NOT EXISTS move_calls_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS transaction_blocks_move_calls_synced_at_idx
  ON transaction_blocks (move_calls_synced_at);
