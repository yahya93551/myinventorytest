-- Add paid status to sales records
-- This migration is safe to run multiple times and will not fail if the column already exists.

ALTER TABLE IF EXISTS sales
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_sales_tenant_id_paid ON sales(tenant_id, paid);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created_at ON sales(tenant_id, created_at DESC);