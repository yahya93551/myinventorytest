-- Migration: add unit-conversion columns to products
-- Safe additive migration for existing installations.
-- Run this against your Supabase/Postgres database (psql or Supabase SQL editor).

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS base_unit text,
  ADD COLUMN IF NOT EXISTS converted_unit text,
  ADD COLUMN IF NOT EXISTS conversion_rate numeric(10,4);

COMMIT;

-- Notes:
-- - These columns are nullable so existing products keep working.
-- - The app validates the values before saving.
-- - If you use Supabase, open the SQL editor and run this script.
