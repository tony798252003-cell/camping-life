-- Add new columns to campsites table

-- 1. Amenities (JSONB for flexibility: fridge, water_dispenser, etc.)
ALTER TABLE public.campsites
ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '{}'::jsonb;

-- 2. Rules & Timings (Text fields)
ALTER TABLE public.campsites
ADD COLUMN IF NOT EXISTS check_in_time text,
ADD COLUMN IF NOT EXISTS check_out_time text,
ADD COLUMN IF NOT EXISTS night_rush_time text,
ADD COLUMN IF NOT EXISTS shower_restrictions text;

-- Comment on columns for documentation
COMMENT ON COLUMN public.campsites.amenities IS 'JSONB object storing boolean flags like has_fridge, has_water etc.';
COMMENT ON COLUMN public.campsites.check_in_time IS 'General check-in time';
COMMENT ON COLUMN public.campsites.check_out_time IS 'General check-out time';
COMMENT ON COLUMN public.campsites.night_rush_time IS 'Night rush entry time window';
COMMENT ON COLUMN public.campsites.shower_restrictions IS 'Shower availability or restrictions';
