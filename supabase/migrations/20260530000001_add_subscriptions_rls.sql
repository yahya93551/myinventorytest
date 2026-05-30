-- Create RLS policies for tenant_subscriptions table
-- Admins can view all subscriptions
-- Owners can only view their own subscription

-- Enable RLS on tenant_subscriptions
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage all subscriptions
CREATE POLICY admin_view_all_subscriptions ON tenant_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.user_id = auth.uid()
      AND tenant_members.role = 'admin'
    )
  );

CREATE POLICY admin_manage_subscriptions ON tenant_subscriptions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.user_id = auth.uid()
      AND tenant_members.role = 'admin'
    )
  );

-- Owners can view their own subscription
CREATE POLICY owner_view_own_subscription ON tenant_subscriptions
  FOR SELECT
  USING (auth.uid() = tenant_id);

-- Owners can insert their own subscription request
CREATE POLICY owner_request_subscription ON tenant_subscriptions
  FOR INSERT
  WITH CHECK (
    auth.uid() = tenant_id
    AND EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.tenant_id = auth.uid()
      AND tenant_members.user_id = auth.uid()
      AND tenant_members.role = 'owner'
    )
  );

-- Grant appropriate permissions
GRANT SELECT, INSERT ON tenant_subscriptions TO authenticated;
GRANT UPDATE ON tenant_subscriptions TO authenticated;
