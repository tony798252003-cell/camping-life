-- Add onboarding_completed_at column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Add comment
COMMENT ON COLUMN profiles.onboarding_completed_at IS 'Timestamp when user completed onboarding wizard';
