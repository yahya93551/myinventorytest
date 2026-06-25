-- Migration: add `plan` column to tenant_subscriptions
-- Run this against your Supabase/Postgres database (psql or Supabase SQL editor).

BEGIN;

-- Add `plan` column with default 'basic' and not null constraint
ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'basic';

-- Backfill existing rows that may be NULL
UPDATE public.tenant_subscriptions
SET plan = 'basic'
WHERE plan IS NULL;

COMMIT;

-- Notes:
-- - If you use Supabase, open the SQL editor and run this script.
-- - After applying, the API will be able to store `plan` directly without the fallback retry.
