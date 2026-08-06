-- Add stock_remainder to products to track leftover converted units (pieces)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS stock_remainder integer DEFAULT 0 NOT NULL;

-- Ensure existing rows have a default value
UPDATE products SET stock_remainder = 0 WHERE stock_remainder IS NULL;
