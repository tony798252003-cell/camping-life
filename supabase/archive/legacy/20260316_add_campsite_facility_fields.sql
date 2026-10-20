-- supabase/migrations/20260316_add_campsite_facility_fields.sql

ALTER TABLE public.campsites
  ADD COLUMN IF NOT EXISTS playground_features text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS water_features text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scenery_features text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS spot_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS booking_method text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS booking_available_until date,
  ADD COLUMN IF NOT EXISTS booking_timing text,
  ADD COLUMN IF NOT EXISTS booking_difficulty text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS recommended_spots text,
  ADD COLUMN IF NOT EXISTS campsite_notes text,
  ADD COLUMN IF NOT EXISTS booking_platform text,
  ADD COLUMN IF NOT EXISTS booking_platform_url text,
  ADD COLUMN IF NOT EXISTS booking_last_available_date date,
  ADD COLUMN IF NOT EXISTS booking_scraped_at timestamptz;

COMMENT ON COLUMN public.campsites.playground_features IS '遊樂設施標籤，如沙坑、溜滑梯';
COMMENT ON COLUMN public.campsites.water_features IS '水域設施標籤，如戲水池、溪流';
COMMENT ON COLUMN public.campsites.scenery_features IS '自然景觀標籤，如櫻花、螢火蟲';
COMMENT ON COLUMN public.campsites.spot_types IS '營位類型，如草地、棧板';
COMMENT ON COLUMN public.campsites.booking_method IS '訂位方式，如電話、FB';
COMMENT ON COLUMN public.campsites.booking_difficulty IS '搶位難度：normal / moderate / hard';
COMMENT ON COLUMN public.campsites.booking_platform IS '訂位平台：icamping / campingfun';
COMMENT ON COLUMN public.campsites.booking_last_available_date IS '上次爬取時平台最遠可訂日期（供偵測新訂位開放用）';
