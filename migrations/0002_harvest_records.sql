-- Harvest and production records.
CREATE TABLE IF NOT EXISTS harvest_records (
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  crop_cycle_id TEXT,
  harvested_on TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  quality_grade TEXT,
  destination TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id, organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (field_id, organization_id) REFERENCES fields(id, organization_id),
  FOREIGN KEY (crop_cycle_id, organization_id) REFERENCES crop_cycles(id, organization_id),
  FOREIGN KEY (organization_id, created_by) REFERENCES memberships(organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_harvest_records_date ON harvest_records(organization_id, harvested_on);
CREATE INDEX IF NOT EXISTS idx_harvest_records_field ON harvest_records(organization_id, field_id, harvested_on);
