CREATE TABLE IF NOT EXISTS suiscan_records (
  id BIGSERIAL PRIMARY KEY,
  source_url TEXT NOT NULL,
  record_type TEXT NOT NULL,
  network TEXT NOT NULL,
  tx_digest TEXT,
  account_address TEXT,
  short_prefix TEXT,
  short_suffix TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT suiscan_records_record_type_check
    CHECK (record_type IN ('tx', 'account')),
  CONSTRAINT suiscan_records_target_check
    CHECK (
      (record_type = 'tx' AND tx_digest IS NOT NULL AND account_address IS NULL) OR
      (record_type = 'account' AND account_address IS NOT NULL AND tx_digest IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS suiscan_records_source_url_idx
  ON suiscan_records (source_url);

CREATE INDEX IF NOT EXISTS suiscan_records_record_type_idx
  ON suiscan_records (record_type);

CREATE INDEX IF NOT EXISTS suiscan_records_network_idx
  ON suiscan_records (network);

CREATE INDEX IF NOT EXISTS suiscan_records_tx_digest_idx
  ON suiscan_records (tx_digest)
  WHERE tx_digest IS NOT NULL;

CREATE INDEX IF NOT EXISTS suiscan_records_account_address_idx
  ON suiscan_records (account_address)
  WHERE account_address IS NOT NULL;
