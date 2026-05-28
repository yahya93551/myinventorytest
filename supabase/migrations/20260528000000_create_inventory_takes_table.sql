CREATE TABLE IF NOT EXISTS inventory_takes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  quantity_taken integer NOT NULL CHECK (quantity_taken > 0),
  remaining_quantity integer NOT NULL CHECK (remaining_quantity >= 0),
  reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_takes_tenant_id ON inventory_takes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_takes_user_id ON inventory_takes(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_takes_product_id ON inventory_takes(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_takes_remaining_quantity ON inventory_takes(remaining_quantity);
