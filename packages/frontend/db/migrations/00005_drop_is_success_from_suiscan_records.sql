DROP INDEX IF EXISTS suiscan_records_is_success_idx;

ALTER TABLE suiscan_records
DROP COLUMN IF EXISTS is_success;
