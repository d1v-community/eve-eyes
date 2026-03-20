CREATE TABLE IF NOT EXISTS wallet_login_challenges (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  nonce TEXT NOT NULL,
  message TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'sui',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wallet_login_challenges_wallet_address_idx
  ON wallet_login_challenges (wallet_address);

CREATE INDEX IF NOT EXISTS wallet_login_challenges_expires_at_idx
  ON wallet_login_challenges (expires_at);

CREATE TABLE IF NOT EXISTS user_api_keys (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  rate_limit_tps INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS user_api_keys_key_hash_idx
  ON user_api_keys (key_hash);

CREATE INDEX IF NOT EXISTS user_api_keys_user_id_idx
  ON user_api_keys (user_id);

CREATE INDEX IF NOT EXISTS user_api_keys_active_idx
  ON user_api_keys (user_id, revoked_at, created_at DESC);

CREATE TABLE IF NOT EXISTS api_key_rate_limit_windows (
  api_key_id BIGINT NOT NULL REFERENCES user_api_keys (id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (api_key_id, window_started_at)
);

CREATE INDEX IF NOT EXISTS api_key_rate_limit_windows_window_started_at_idx
  ON api_key_rate_limit_windows (window_started_at);

CREATE INDEX IF NOT EXISTS transaction_blocks_listing_idx
  ON transaction_blocks (transaction_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS transaction_blocks_status_time_idx
  ON transaction_blocks (status, transaction_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS transaction_blocks_sender_time_idx
  ON transaction_blocks (sender_address, transaction_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS suiscan_move_calls_listing_idx
  ON suiscan_move_calls (transaction_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS suiscan_move_calls_package_time_idx
  ON suiscan_move_calls (package_id, transaction_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS suiscan_move_calls_module_function_time_idx
  ON suiscan_move_calls (module_name, function_name, transaction_time DESC, id DESC);
