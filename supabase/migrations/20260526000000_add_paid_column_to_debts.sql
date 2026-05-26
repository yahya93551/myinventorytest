-- Add paid status to debts
-- This migration is safe to run multiple times and will not fail if the column already exists.

ALTER TABLE IF EXISTS debts
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;

-- Keep the debts table indexed for tenant and creation order.
CREATE INDEX IF NOT EXISTS idx_debts_tenant_id ON debts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_debts_tenant_created_at ON debts(tenant_id, created_at DESC);
