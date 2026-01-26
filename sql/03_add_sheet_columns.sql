-- 1. 新增 tags (陣列), phone (文字), zone_config (文字)
-- 注意: Supabase Postgres 支援 TEXT[] 陣列型態
ALTER TABLE campsites 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS zone_config TEXT;
