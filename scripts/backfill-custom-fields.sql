-- scripts/backfill-custom-fields.sql
--
-- Safe SQL helper for backfilling missing custom field values in products.custom_data.
-- Replace the placeholders with your actual tenant ID and field names.
-- This file is non-destructive and only updates rows that are missing the key.

-- 1) Dry-run: see products missing a given custom field key
-- Replace tenant-id and field_name below.
SELECT id, custom_data
FROM products
WHERE tenant_id = 'your-tenant-id'
  AND NOT (COALESCE(custom_data, '{}'::jsonb) ? 'field_name')
LIMIT 50;

-- 2) Optional: inspect the missing value in a readable form
SELECT id,
       custom_data->>'field_name' AS field_name_value,
       custom_data
FROM products
WHERE tenant_id = 'your-tenant-id'
  AND NOT (COALESCE(custom_data, '{}'::jsonb) ? 'field_name')
LIMIT 50;

-- 3) Backfill a single missing field with a default value
UPDATE products
SET custom_data = jsonb_set(
  COALESCE(custom_data, '{}'::jsonb),
  '{field_name}',
  to_jsonb('default_value'),
  true
)
WHERE tenant_id = 'your-tenant-id'
  AND NOT (COALESCE(custom_data, '{}'::jsonb) ? 'field_name');

-- 4) Backfill a single missing field with explicit null
UPDATE products
SET custom_data = jsonb_set(
  COALESCE(custom_data, '{}'::jsonb),
  '{field_name}',
  'null'::jsonb,
  true
)
WHERE tenant_id = 'your-tenant-id'
  AND NOT (COALESCE(custom_data, '{}'::jsonb) ? 'field_name');

-- 5) Backfill multiple fields at once
UPDATE products
SET custom_data = jsonb_set(
  jsonb_set(
    COALESCE(custom_data, '{}'::jsonb),
    '{field_one}',
    to_jsonb('default_one'),
    true
  ),
  '{field_two}',
  to_jsonb('default_two'),
  true
)
WHERE tenant_id = 'your-tenant-id'
  AND (
    NOT (COALESCE(custom_data, '{}'::jsonb) ? 'field_one')
    OR NOT (COALESCE(custom_data, '{}'::jsonb) ? 'field_two')
  );
