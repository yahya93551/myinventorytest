-- Add system field support to custom_fields table
-- Allows standard columns (name, category, price, stock, notes) to be stored and managed like custom fields

ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_fields_is_system ON custom_fields(tenant_id, is_system);

-- Function to initialize system fields for a tenant
CREATE OR REPLACE FUNCTION initialize_system_fields(target_tenant_id uuid, creator_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert system fields if they don't already exist for this tenant
  INSERT INTO custom_fields (
    tenant_id,
    field_name,
    display_name,
    field_type,
    is_system,
    is_required,
    is_visible,
    field_order,
    created_by
  ) VALUES
    (target_tenant_id, 'name', 'Name', 'text', true, false, true, 0, creator_user_id),
    (target_tenant_id, 'category', 'Category', 'text', true, false, true, 1, creator_user_id),
    (target_tenant_id, 'cost_price', 'Cost Price', 'currency', true, false, true, 2, creator_user_id),
    (target_tenant_id, 'price', 'Sell Price', 'currency', true, false, true, 3, creator_user_id),
    (target_tenant_id, 'stock', 'Stock', 'number', true, false, true, 4, creator_user_id)
  ON CONFLICT (tenant_id, field_name) DO NOTHING;
END;
$$;
