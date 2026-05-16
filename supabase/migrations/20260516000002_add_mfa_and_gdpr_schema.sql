-- Phase 2: Add MFA/2FA support to the database
-- This migration extends profiles table with MFA settings

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add MFA columns to profiles table
ALTER TABLE IF EXISTS profiles
ADD COLUMN IF NOT EXISTS mfa_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_method text, -- 'totp', 'sms', 'email'
ADD COLUMN IF NOT EXISTS mfa_secret text, -- Encrypted TOTP secret
ADD COLUMN IF NOT EXISTS mfa_backup_codes jsonb, -- Encrypted backup codes array
ADD COLUMN IF NOT EXISTS mfa_verified_at timestamptz, -- When 2FA was confirmed
ADD COLUMN IF NOT EXISTS mfa_attempts integer DEFAULT 0, -- Failed MFA attempts
ADD COLUMN IF NOT EXISTS mfa_last_attempt timestamptz; -- Last failed attempt timestamp

-- Create table for user sessions (session management)
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL UNIQUE,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip_address ON user_sessions(user_id, ip_address);

-- Create table for MFA verification attempts (rate limiting)
CREATE TABLE IF NOT EXISTS mfa_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfa_attempts_user_id ON mfa_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_attempts_locked_until ON mfa_attempts(locked_until);

-- Create table for data export requests (GDPR)
CREATE TABLE IF NOT EXISTS data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  export_token text NOT NULL UNIQUE,
  export_url text,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'ready', 'expired', 'downloaded'
  data_format text DEFAULT 'json', -- 'json', 'csv'
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  downloaded_at timestamptz,
  created_by uuid NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_export_user_id ON data_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_export_status ON data_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_export_expires_at ON data_export_requests(expires_at);

-- Create table for account deletion requests (GDPR)
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  deletion_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'processing', 'completed'
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  requested_by uuid NOT NULL,
  ip_address inet
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id ON account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_expires_at ON account_deletion_requests(expires_at);

-- Add check constraints for data integrity
ALTER TABLE user_sessions
ADD CONSTRAINT check_session_dates
CHECK (created_at <= last_activity AND last_activity <= expires_at);

ALTER TABLE data_export_requests
ADD CONSTRAINT check_export_status
CHECK (status IN ('pending', 'processing', 'ready', 'expired', 'downloaded'));

ALTER TABLE account_deletion_requests
ADD CONSTRAINT check_deletion_status
CHECK (status IN ('pending', 'confirmed', 'processing', 'completed'));
