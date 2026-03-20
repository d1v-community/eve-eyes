ALTER TABLE suiscan_records
ADD COLUMN IF NOT EXISTS tx_status TEXT;

CREATE INDEX IF NOT EXISTS suiscan_records_tx_status_idx
  ON suiscan_records (tx_status);

CREATE TABLE IF NOT EXISTS suiscan_move_calls (
  id BIGSERIAL PRIMARY KEY,
  tx_digest TEXT NOT NULL,
  call_index INTEGER NOT NULL,
  package_id TEXT,
  module_name TEXT,
  function_name TEXT,
  raw_call JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS suiscan_move_calls_tx_digest_call_index_idx
  ON suiscan_move_calls (tx_digest, call_index);

CREATE INDEX IF NOT EXISTS suiscan_move_calls_tx_digest_idx
  ON suiscan_move_calls (tx_digest);

CREATE INDEX IF NOT EXISTS suiscan_move_calls_package_id_idx
  ON suiscan_move_calls (package_id);

CREATE INDEX IF NOT EXISTS suiscan_move_calls_module_name_idx
  ON suiscan_move_calls (module_name);

CREATE INDEX IF NOT EXISTS suiscan_move_calls_function_name_idx
  ON suiscan_move_calls (function_name);
