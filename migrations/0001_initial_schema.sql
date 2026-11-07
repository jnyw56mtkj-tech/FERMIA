-- Multi-organization data model. Business records are scoped to organization_id.
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS memberships (
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'viewer')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (organization_id, user_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS farms (
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  area_hectares REAL CHECK (area_hectares IS NULL OR area_hectares >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id, organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS fields (
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  area_hectares REAL CHECK (area_hectares IS NULL OR area_hectares >= 0),
  soil_type TEXT,
  water_source TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id, organization_id),
  FOREIGN KEY (farm_id, organization_id) REFERENCES farms(id, organization_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS crop_cycles (
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  crop_name TEXT NOT NULL,
  variety TEXT,
  season TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'growing', 'harvested', 'archived')),
  planting_date TEXT,
  expected_harvest_date TEXT,
  actual_harvest_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id, organization_id),
  FOREIGN KEY (field_id, organization_id) REFERENCES fields(id, organization_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS work_tasks (
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  farm_id TEXT,
  field_id TEXT,
  crop_cycle_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  assigned_to TEXT,
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  completed_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id, organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (farm_id, organization_id) REFERENCES farms(id, organization_id),
  FOREIGN KEY (field_id, organization_id) REFERENCES fields(id, organization_id),
  FOREIGN KEY (crop_cycle_id, organization_id) REFERENCES crop_cycles(id, organization_id),
  FOREIGN KEY (organization_id, assigned_to) REFERENCES memberships(organization_id, user_id),
  FOREIGN KEY (organization_id, created_by) REFERENCES memberships(organization_id, user_id)
);
CREATE TABLE IF NOT EXISTS work_logs (
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  task_id TEXT,
  field_id TEXT,
  user_id TEXT,
  work_date TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id, organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id, organization_id) REFERENCES work_tasks(id, organization_id),
  FOREIGN KEY (field_id, organization_id) REFERENCES fields(id, organization_id),
  FOREIGN KEY (organization_id, user_id) REFERENCES memberships(organization_id, user_id)
);
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_threshold REAL CHECK (reorder_threshold IS NULL OR reorder_threshold >= 0),
  storage_location TEXT,
  lot_number TEXT,
  expires_on TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id, organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('in', 'out', 'adjustment')),
  quantity REAL NOT NULL CHECK (quantity > 0),
  occurred_at TEXT NOT NULL,
  related_task_id TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id, organization_id),
  FOREIGN KEY (item_id, organization_id) REFERENCES inventory_items(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (related_task_id, organization_id) REFERENCES work_tasks(id, organization_id),
  FOREIGN KEY (organization_id, created_by) REFERENCES memberships(organization_id, user_id)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, actor_user_id) REFERENCES memberships(organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_farms_org ON farms(organization_id);
CREATE INDEX IF NOT EXISTS idx_fields_farm ON fields(organization_id, farm_id);
CREATE INDEX IF NOT EXISTS idx_crop_cycles_field ON crop_cycles(organization_id, field_id);
CREATE INDEX IF NOT EXISTS idx_work_tasks_schedule ON work_tasks(organization_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_work_tasks_status ON work_tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_work_logs_date ON work_logs(organization_id, work_date);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(organization_id, item_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_org_date ON audit_events(organization_id, created_at);
