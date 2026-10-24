-- 營區 Google 評分（2026-10-24 使用者要求：匯入中北部營區並以 Google 評分濾掉低分）
-- Google Maps Platform 條款只允許長期保存 place_id；評分等內容每月由排程重新抓取，
-- google_rating_at 記錄最後更新時間，超過 30 天的資料排程會再刷新。
-- 套用後：再跑 `npm run db:types`。

begin;

alter table public.campsites
  add column google_rating numeric(2, 1) null check (google_rating between 1 and 5),
  add column google_rating_count integer null check (google_rating_count >= 0),
  add column google_rating_at timestamptz null,
  add column google_business_status text null
    check (google_business_status in ('OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'));

-- campsites 的寫入走表層級授權（Allow authenticated users to update campsites），新欄位自動涵蓋。

commit;

-- ---------------------------------------------------------------------------
-- rollback（使用者手動執行，不會自動跑）
-- ---------------------------------------------------------------------------
-- begin;
-- alter table public.campsites
--   drop column if exists google_business_status,
--   drop column if exists google_rating_at,
--   drop column if exists google_rating_count,
--   drop column if exists google_rating;
-- commit;
