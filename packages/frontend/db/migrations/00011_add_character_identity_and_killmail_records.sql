ALTER TABLE transaction_blocks
ADD COLUMN IF NOT EXISTS derived_records_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS transaction_blocks_derived_records_synced_at_idx
  ON transaction_blocks (derived_records_synced_at);

CREATE TABLE IF NOT EXISTS character_identity (
  id BIGSERIAL PRIMARY KEY,
  tenant TEXT NOT NULL,
  character_item_id TEXT NOT NULL,
  character_object_id TEXT NOT NULL,
  character_address TEXT NOT NULL,
  source_tx_digest TEXT NOT NULL,
  source_tx_timestamp TIMESTAMPTZ NOT NULL,
  source_object_version TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT character_identity_valid_range_check
    CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS character_identity_object_version_idx
  ON character_identity (character_object_id, source_object_version);

CREATE UNIQUE INDEX IF NOT EXISTS character_identity_current_object_idx
  ON character_identity (character_object_id)
  WHERE is_current;

CREATE UNIQUE INDEX IF NOT EXISTS character_identity_current_item_idx
  ON character_identity (tenant, character_item_id)
  WHERE is_current;

CREATE INDEX IF NOT EXISTS character_identity_lookup_idx
  ON character_identity (tenant, character_item_id, valid_from DESC);

CREATE INDEX IF NOT EXISTS character_identity_current_lookup_idx
  ON character_identity (tenant, character_item_id)
  WHERE is_current;

CREATE TABLE IF NOT EXISTS killmail_records (
  id BIGSERIAL PRIMARY KEY,
  tenant TEXT NOT NULL,
  killmail_item_id TEXT NOT NULL,
  tx_digest TEXT NOT NULL,
  event_seq TEXT NOT NULL,
  tx_checkpoint TEXT,
  tx_timestamp TIMESTAMPTZ NOT NULL,
  kill_timestamp TIMESTAMPTZ NOT NULL,
  kill_timestamp_unix TEXT NOT NULL,
  loss_type TEXT NOT NULL,
  solar_system_id TEXT NOT NULL,
  killer_character_item_id TEXT NOT NULL,
  victim_character_item_id TEXT NOT NULL,
  reported_by_character_item_id TEXT NOT NULL,
  killer_wallet_address TEXT,
  victim_wallet_address TEXT,
  reported_by_wallet_address TEXT,
  resolution_status TEXT NOT NULL DEFAULT 'pending',
  resolution_error TEXT,
  resolved_at TIMESTAMPTZ,
  raw_event JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT killmail_records_resolution_status_check
    CHECK (resolution_status IN ('pending', 'resolved'))
);

CREATE UNIQUE INDEX IF NOT EXISTS killmail_records_tx_event_idx
  ON killmail_records (tx_digest, event_seq);

CREATE UNIQUE INDEX IF NOT EXISTS killmail_records_item_idx
  ON killmail_records (tenant, killmail_item_id);

CREATE INDEX IF NOT EXISTS killmail_records_resolution_status_idx
  ON killmail_records (resolution_status, kill_timestamp DESC);

CREATE INDEX IF NOT EXISTS killmail_records_kill_timestamp_idx
  ON killmail_records (kill_timestamp DESC);

CREATE INDEX IF NOT EXISTS killmail_records_character_lookup_idx
  ON killmail_records (
    tenant,
    killer_character_item_id,
    victim_character_item_id,
    reported_by_character_item_id
  );
