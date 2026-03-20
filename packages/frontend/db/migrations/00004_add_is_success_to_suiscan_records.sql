ALTER TABLE suiscan_records
ADD COLUMN IF NOT EXISTS is_success BOOLEAN;

CREATE INDEX IF NOT EXISTS suiscan_records_is_success_idx
  ON suiscan_records (is_success);
