-- Add enhanced audit logging columns
-- This migration extends activity_logs with IP, user agent, and HTTP metadata

ALTER TABLE activity_logs
ADD COLUMN IF NOT EXISTS ip_address inet,
ADD COLUMN IF NOT EXISTS user_agent text,
ADD COLUMN IF NOT EXISTS http_method text,
ADD COLUMN IF NOT EXISTS endpoint text,
ADD COLUMN IF NOT EXISTS status_code integer;

-- Create index for IP-based queries (security investigations)
CREATE INDEX IF NOT EXISTS idx_activity_logs_ip_address 
ON activity_logs(tenant_id, ip_address);

-- Create index for action-based queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_action 
ON activity_logs(tenant_id, action, created_at DESC);

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at 
ON activity_logs(tenant_id, created_at DESC);
