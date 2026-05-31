-- Fix subscription schema inconsistencies for live databases
-- Allows subscription requests to be created before approval.

ALTER TABLE tenant_subscriptions
  ADD COLUMN IF NOT EXISTS notes text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_subscriptions'
      AND column_name = 'billing_date'
  ) THEN
    EXECUTE 'ALTER TABLE tenant_subscriptions ALTER COLUMN billing_date DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_subscriptions'
      AND column_name = 'next_billing_date'
  ) THEN
    EXECUTE 'ALTER TABLE tenant_subscriptions ALTER COLUMN next_billing_date DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_subscriptions'
      AND column_name = 'active_until'
  ) THEN
    EXECUTE 'ALTER TABLE tenant_subscriptions ALTER COLUMN active_until DROP NOT NULL';
  END IF;
END$$;
