-- Add product cost price to support cost/sell/profit reporting
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0);