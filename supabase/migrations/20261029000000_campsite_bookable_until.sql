-- 營區「目前可訂到哪天」與週六客滿比例（2026-10-25 使用者要求：選月份就知道哪些能訂、列表看得到難訂）
-- 資料來源：Claude 在使用者要求時，以瀏覽器讀愛露營營區頁「最後可訂位日」、露營樂「空位查詢」日曆；
-- app 不自動抓取，資料會過時，畫面要顯示 bookable_checked_at。
-- 套用後：再跑 `npm run db:types`。

begin;

alter table public.campsites
  add column bookable_until date null,
  add column bookable_checked_at timestamptz null,
  add column bookable_source text null,
  add column saturday_full_ratio numeric(3, 2) null check (saturday_full_ratio between 0 and 1),
  add column saturday_sample integer null check (saturday_sample >= 0);

-- campsites 的寫入是表層級授權，新欄位自動涵蓋。

commit;

-- rollback（手動執行）
-- begin;
-- alter table public.campsites
--   drop column if exists saturday_sample,
--   drop column if exists saturday_full_ratio,
--   drop column if exists bookable_source,
--   drop column if exists bookable_checked_at,
--   drop column if exists bookable_until;
-- commit;
