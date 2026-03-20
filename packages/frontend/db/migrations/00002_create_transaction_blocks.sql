CREATE TABLE IF NOT EXISTS transaction_blocks (
  id BIGSERIAL PRIMARY KEY,
  digest TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'sui',
  checkpoint BIGINT,
  sender_address TEXT,
  transaction_kind TEXT,
  status TEXT,
  error_message TEXT,
  executed_at TIMESTAMPTZ,
  raw_content JSONB NOT NULL,
  effects JSONB,
  events JSONB,
  object_changes JSONB,
  balance_changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS transaction_blocks_network_digest_idx
  ON transaction_blocks (network, digest);

CREATE INDEX IF NOT EXISTS transaction_blocks_sender_address_idx
  ON transaction_blocks (sender_address);

CREATE INDEX IF NOT EXISTS transaction_blocks_checkpoint_idx
  ON transaction_blocks (checkpoint);

CREATE INDEX IF NOT EXISTS transaction_blocks_executed_at_idx
  ON transaction_blocks (executed_at DESC);
