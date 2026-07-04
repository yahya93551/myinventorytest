-- Add optional phone field to profiles for linked owner phone numbers
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
