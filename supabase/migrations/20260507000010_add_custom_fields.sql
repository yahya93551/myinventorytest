-- Create custom fields schema for multi-business-type support
-- Allows each tenant to define their own product table columns

CREATE TABLE IF NOT EXISTS custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  display_name text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'checkbox', 'textarea', 'currency')),
  is_required boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  field_order integer NOT NULL DEFAULT 0,
  select_options text[], -- For select type fields, comma-separated options
  default_value text,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_tenant_id ON custom_fields(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_order ON custom_fields(tenant_id, field_order);

-- Add JSONB column to products table to store custom field values
ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;

-- Business type settings for tenants
CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_type text NOT NULL CHECK (business_type IN ('pharmacy', 'ngo', 'warehouse', 'supermarket', 'retail_shop', 'distributor', 'custom')),
  description text,
  business_name text,
  business_address text,
  business_contact_name text,
  business_contact_phone text,
  business_contact_email text,
  business_website text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_settings_tenant_id ON business_settings(tenant_id);

-- RLS Policies for custom fields
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY custom_fields_select ON custom_fields
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND active
    )
  );

CREATE POLICY custom_fields_insert ON custom_fields
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner' AND active
    )
  );

CREATE POLICY custom_fields_update ON custom_fields
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner' AND active
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner' AND active
    )
  );

CREATE POLICY custom_fields_delete ON custom_fields
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner' AND active
    )
  );

-- RLS Policies for business settings
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_settings_select ON business_settings
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND active
    )
  );

CREATE POLICY business_settings_insert ON business_settings
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner' AND active
    )
  );

CREATE POLICY business_settings_update ON business_settings
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner' AND active
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner' AND active
    )
  );
