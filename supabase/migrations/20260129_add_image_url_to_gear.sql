-- Add image_url column to camping_gear table
ALTER TABLE camping_gear 
ADD COLUMN IF NOT EXISTS image_url text;
