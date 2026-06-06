-- Create table for OTP (One-Time Password) codes for phone verification
CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient OTP lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_code ON otp_codes(phone, code);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);

-- Optional: Add RLS policies if you want to restrict access
-- For now, OTP codes are server-side only, so basic security is fine
