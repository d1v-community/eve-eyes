CREATE INDEX IF NOT EXISTS transaction_blocks_digest_idx
  ON transaction_blocks (digest);

CREATE INDEX IF NOT EXISTS transaction_blocks_transaction_time_id_idx
  ON transaction_blocks (transaction_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS suiscan_move_calls_transaction_time_id_idx
  ON suiscan_move_calls (transaction_time DESC, id DESC);
