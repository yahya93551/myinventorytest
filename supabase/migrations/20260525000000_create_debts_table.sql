-- Create debts table for tenant-specific customer credit and balances
-- This migration is safe to run multiple times and will not fail if the table already exists.

CREATE TABLE IF NOT EXISTS debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  note text,
  date text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debts_tenant_id ON debts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_debts_customer_phone ON debts(customer_phone);
CREATE INDEX IF NOT EXISTS idx_debts_tenant_created_at ON debts(tenant_id, created_at DESC);
