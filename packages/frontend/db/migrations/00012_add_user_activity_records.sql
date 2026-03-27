ALTER TABLE transaction_blocks
ADD COLUMN IF NOT EXISTS user_activity_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS transaction_blocks_user_activity_synced_at_idx
  ON transaction_blocks (user_activity_synced_at);

CREATE INDEX IF NOT EXISTS character_identity_address_lookup_idx
  ON character_identity (character_address, valid_from DESC);

CREATE INDEX IF NOT EXISTS killmail_records_killer_wallet_idx
  ON killmail_records (killer_wallet_address, kill_timestamp DESC);

CREATE INDEX IF NOT EXISTS killmail_records_victim_wallet_idx
  ON killmail_records (victim_wallet_address, kill_timestamp DESC);

CREATE INDEX IF NOT EXISTS killmail_records_reported_by_wallet_idx
  ON killmail_records (reported_by_wallet_address, kill_timestamp DESC);

CREATE TABLE IF NOT EXISTS user_activity_records (
  id BIGSERIAL PRIMARY KEY,
  tenant TEXT,
  tx_digest TEXT NOT NULL,
  event_seq TEXT,
  call_index INTEGER,
  activity_time TIMESTAMPTZ NOT NULL,
  activity_type TEXT NOT NULL,
  module_name TEXT,
  function_name TEXT,
  source_kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  primary_wallet_address TEXT,
  primary_character_item_id TEXT,
  primary_character_object_id TEXT,
  raw_source JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_activity_records_source_kind_check
    CHECK (source_kind IN ('event', 'move_call', 'derived'))
);

CREATE INDEX IF NOT EXISTS user_activity_records_wallet_time_idx
  ON user_activity_records (primary_wallet_address, activity_time DESC);

CREATE INDEX IF NOT EXISTS user_activity_records_activity_time_idx
  ON user_activity_records (activity_time DESC);

CREATE INDEX IF NOT EXISTS user_activity_records_type_time_idx
  ON user_activity_records (activity_type, activity_time DESC);

CREATE INDEX IF NOT EXISTS user_activity_records_tenant_time_idx
  ON user_activity_records (tenant, activity_time DESC);

CREATE INDEX IF NOT EXISTS user_activity_records_tx_digest_idx
  ON user_activity_records (tx_digest);

CREATE INDEX IF NOT EXISTS user_activity_records_module_function_idx
  ON user_activity_records (module_name, function_name, activity_time DESC);

CREATE UNIQUE INDEX IF NOT EXISTS user_activity_records_tx_event_unique_idx
  ON user_activity_records (tx_digest, event_seq, activity_type, source_kind)
  WHERE event_seq IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_activity_records_tx_call_unique_idx
  ON user_activity_records (tx_digest, call_index, activity_type, source_kind)
  WHERE call_index IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_activity_participants (
  id BIGSERIAL PRIMARY KEY,
  activity_record_id BIGINT NOT NULL REFERENCES user_activity_records (id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  tenant TEXT,
  character_item_id TEXT,
  character_object_id TEXT,
  wallet_address TEXT,
  resolved_via TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_activity_participants_activity_idx
  ON user_activity_participants (activity_record_id);

CREATE INDEX IF NOT EXISTS user_activity_participants_wallet_idx
  ON user_activity_participants (wallet_address, activity_record_id);

CREATE INDEX IF NOT EXISTS user_activity_participants_character_item_idx
  ON user_activity_participants (tenant, character_item_id, activity_record_id);

CREATE INDEX IF NOT EXISTS user_activity_participants_character_object_idx
  ON user_activity_participants (character_object_id, activity_record_id);
