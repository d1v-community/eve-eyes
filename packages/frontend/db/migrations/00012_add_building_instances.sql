CREATE TABLE IF NOT EXISTS building_instances (
  id BIGSERIAL PRIMARY KEY,
  tenant TEXT NOT NULL,
  building_item_id TEXT NOT NULL,
  building_object_id TEXT NOT NULL,
  module_name TEXT NOT NULL,
  object_type TEXT NOT NULL,
  type_id TEXT NOT NULL,
  owner_cap_id TEXT NOT NULL,
  owner_character_item_id TEXT,
  owner_character_object_id TEXT,
  status TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_tx_digest TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_tx_digest TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS building_instances_item_idx
  ON building_instances (tenant, building_item_id);

CREATE UNIQUE INDEX IF NOT EXISTS building_instances_owner_cap_idx
  ON building_instances (owner_cap_id);

CREATE INDEX IF NOT EXISTS building_instances_object_idx
  ON building_instances (building_object_id);

CREATE INDEX IF NOT EXISTS building_instances_owner_character_idx
  ON building_instances (tenant, owner_character_item_id)
  WHERE owner_character_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS building_instances_active_module_idx
  ON building_instances (is_active, module_name, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS building_instances_active_type_idx
  ON building_instances (is_active, type_id, last_seen_at DESC);
