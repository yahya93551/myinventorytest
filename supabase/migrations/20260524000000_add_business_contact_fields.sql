-- Add business contact and info fields to business_settings table
-- Allows storing business name, address, contact info

ALTER TABLE IF EXISTS business_settings ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE IF EXISTS business_settings ADD COLUMN IF NOT EXISTS business_address text;
ALTER TABLE IF EXISTS business_settings ADD COLUMN IF NOT EXISTS business_contact_name text;
ALTER TABLE IF EXISTS business_settings ADD COLUMN IF NOT EXISTS business_contact_phone text;
ALTER TABLE IF EXISTS business_settings ADD COLUMN IF NOT EXISTS business_contact_email text;
ALTER TABLE IF EXISTS business_settings ADD COLUMN IF NOT EXISTS business_website text;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_business_settings_tenant_id ON business_settings(tenant_id);
