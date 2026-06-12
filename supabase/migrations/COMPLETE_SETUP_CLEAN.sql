-- Complete Supabase Setup - FRESH START
-- This drops and recreates everything from scratch

-- Drop all policies first
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_insert ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;
DROP POLICY IF EXISTS tenant_members_select ON tenant_members;
DROP POLICY IF EXISTS tenant_members_insert_self ON tenant_members;
DROP POLICY IF EXISTS tenant_members_update ON tenant_members;
DROP POLICY IF EXISTS tenant_members_delete ON tenant_members;
DROP POLICY IF EXISTS activity_logs_select ON activity_logs;
DROP POLICY IF EXISTS activity_logs_insert ON activity_logs;
DROP POLICY IF EXISTS products_select_tenant ON products;
DROP POLICY IF EXISTS products_insert_role ON products;
DROP POLICY IF EXISTS products_update_role ON products;
DROP POLICY IF EXISTS products_delete_role ON products;
DROP POLICY IF EXISTS sales_select_tenant ON sales;
DROP POLICY IF EXISTS sales_insert_role ON sales;
DROP POLICY IF EXISTS sales_update_owner ON sales;
DROP POLICY IF EXISTS sales_delete_owner ON sales;
DROP POLICY IF EXISTS categories_select_tenant ON categories;
DROP POLICY IF EXISTS categories_insert_role ON categories;
DROP POLICY IF EXISTS categories_update_role ON categories;
DROP POLICY IF EXISTS categories_delete_role ON categories;

-- Drop all tables
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS tenant_members CASCADE;

-- Create extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== CREATE TABLES =====
CREATE TABLE tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'accountant', 'sales')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  performed_by uuid NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  cost_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  total numeric(14,2) NOT NULL CHECK (total >= 0),
  order_id text,
  customer_name text,
  customer_address text,
  customer_phone text,
  paid boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== CREATE INDEXES =====
CREATE UNIQUE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_email ON profiles(email);

CREATE INDEX idx_tenant_members_user_id ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant_id ON tenant_members(tenant_id);

CREATE INDEX idx_activity_logs_tenant_id ON activity_logs(tenant_id);
CREATE INDEX idx_activity_logs_performed_by ON activity_logs(performed_by);

CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_products_tenant_created_at ON products(tenant_id, created_at DESC);
CREATE INDEX idx_products_tenant_stock ON products(tenant_id, stock);
CREATE INDEX idx_products_tenant_category ON products(tenant_id, category);
CREATE INDEX idx_products_id ON products(id);

CREATE INDEX idx_sales_tenant_id ON sales(tenant_id);
CREATE INDEX idx_sales_tenant_created_at ON sales(tenant_id, created_at DESC);
CREATE INDEX idx_sales_product_id ON sales(product_id);
CREATE INDEX idx_sales_user_product ON sales(tenant_id, product_id);

CREATE INDEX idx_categories_tenant_id ON categories(tenant_id);
CREATE INDEX idx_categories_tenant_name ON categories(tenant_id, name);

-- ===== ENABLE ROW LEVEL SECURITY =====
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ===== CREATE POLICIES =====

-- Profiles policies
CREATE POLICY profiles_select ON profiles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY profiles_insert ON profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_update ON profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Tenant membership policies
CREATE POLICY tenant_members_select ON tenant_members
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND active
    )
  );

CREATE POLICY tenant_members_insert_self ON tenant_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = auth.uid()
    AND role = 'owner'
    AND active = true
  );

CREATE POLICY tenant_members_update ON tenant_members
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      tenant_id IN (
        SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner' AND active
      )
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner' AND active
    )
  );

CREATE POLICY tenant_members_delete ON tenant_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR (
      tenant_id IN (
        SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner' AND active
      )
    )
  );

-- Activity logs policies
CREATE POLICY activity_logs_select ON activity_logs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND active
    )
  );

CREATE POLICY activity_logs_insert ON activity_logs
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND active
    )
  );

-- Products policies
CREATE POLICY products_select_tenant ON products
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND active
    )
  );

CREATE POLICY products_insert_role ON products
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'accountant') AND active
    )
  );

CREATE POLICY products_update_role ON products
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'accountant') AND active
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'accountant') AND active
    )
  );

CREATE POLICY products_delete_role ON products
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'accountant') AND active
    )
  );

-- Sales policies
CREATE POLICY sales_select_tenant ON sales
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND active
    )
  );

CREATE POLICY sales_insert_role ON sales
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'sales') AND active
    )
  );

CREATE POLICY sales_update_owner ON sales
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

CREATE POLICY sales_delete_owner ON sales
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'owner' AND active
    )
  );

-- Categories policies
CREATE POLICY categories_select_tenant ON categories
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND active
    )
  );

CREATE POLICY categories_insert_role ON categories
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'accountant') AND active
    )
  );

CREATE POLICY categories_update_role ON categories
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'accountant') AND active
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'accountant') AND active
    )
  );

CREATE POLICY categories_delete_role ON categories
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'accountant') AND active
    )
  );
