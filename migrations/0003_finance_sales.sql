-- Finance, sales and customer records. All references are tenant-scoped.
CREATE TABLE IF NOT EXISTS customers (
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id, organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS sales_records (
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  customer_id TEXT,
  harvest_record_id TEXT,
  sold_on TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity REAL CHECK (quantity IS NULL OR quantity > 0),
  unit TEXT,
  unit_price REAL CHECK (unit_price IS NULL OR unit_price >= 0),
  amount REAL NOT NULL CHECK (amount > 0),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id, organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id, organization_id) REFERENCES customers(id, organization_id),
  FOREIGN KEY (harvest_record_id, organization_id) REFERENCES harvest_records(id, organization_id),
  FOREIGN KEY (organization_id, created_by) REFERENCES memberships(organization_id, user_id)
);
CREATE TABLE IF NOT EXISTS expense_records (
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  spent_on TEXT NOT NULL,
  category TEXT NOT NULL,
  vendor TEXT,
  description TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  payment_method TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id, organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, created_by) REFERENCES memberships(organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_customers_org_name ON customers(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_sales_org_date ON sales_records(organization_id, sold_on);
CREATE INDEX IF NOT EXISTS idx_sales_org_customer ON sales_records(organization_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org_date ON expense_records(organization_id, spent_on);
CREATE INDEX IF NOT EXISTS idx_expenses_org_category ON expense_records(organization_id, category);
