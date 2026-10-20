-- Add brand column to system_assets
ALTER TABLE system_assets 
ADD COLUMN IF NOT EXISTS brand text;

-- Add brand column to camping_gear (just in case)
ALTER TABLE camping_gear 
ADD COLUMN IF NOT EXISTS brand text;
