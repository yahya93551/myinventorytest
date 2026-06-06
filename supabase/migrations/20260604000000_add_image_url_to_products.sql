-- Add optional image_url to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url text;

-- No-op for existing rows; images are optional and can be populated later via UI or import.
