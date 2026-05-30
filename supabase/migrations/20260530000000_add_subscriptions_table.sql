-- Create tenant subscriptions table for monthly fee management
-- Status: active (paying), inactive (not paying), pending (awaiting approval), expired

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'pending', 'expired')),
  monthly_fee numeric(8,2) NOT NULL DEFAULT 5.00,
  billing_date date,
  next_billing_date date,
  active_until timestamptz,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant_id ON tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status ON tenant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_next_billing ON tenant_subscriptions(next_billing_date);

-- Add admin role to tenant_members if not already there
ALTER TABLE tenant_members
DROP CONSTRAINT IF EXISTS tenant_members_role_check;

ALTER TABLE tenant_members
ADD CONSTRAINT tenant_members_role_check CHECK (role IN ('owner', 'accountant', 'sales', 'admin'));
