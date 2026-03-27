ALTER TABLE building_instances
ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS building_instances_active_reconcile_idx
  ON building_instances (is_active, last_reconciled_at ASC NULLS FIRST, id ASC);
