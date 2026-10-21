-- 20261017000200_campsite_fields.sql
-- Task 1.6：營區地點欄位（place_id、address、maps_url、business_status、field_sources）與軟合併標記 merged_into_id（規格 §6.2、§17 S1）。
-- 使用方式：先跑 `npx tsx scripts/backup/backup-all.ts`（exit 0），再整份貼進 Supabase SQL Editor；套用後跑 `npm run db:types`。
-- 前提：20261020000000_enable_rls_core_tables.sql 已套用。全部只做加法，不刪、不改任何資料列；套用後舊前端不受影響。
--
-- 權限說明：campsites 的 authenticated 權限是「表層級」GRANT ALL（baseline），RLS migration 只收回 TRUNCATE/REFERENCES/TRIGGER，
-- 沒有改成欄位授權（profiles 才是欄位授權）。所以新增欄位自動涵蓋 SELECT/INSERT/UPDATE，不需要另外 GRANT。
-- camping_trips 同理（表層級）。RLS policy 都不是欄位層級，也不用改。

begin;

alter table public.campsites
  add column if not exists google_place_id text,
  add column if not exists address text,
  add column if not exists google_maps_url text,
  add column if not exists business_status text
    check (business_status in ('open','temporarily_closed','closed')),
  add column if not exists field_sources jsonb not null default '{}'::jsonb,
  add column if not exists merged_into_id bigint
    references public.campsites(id) on delete set null;

-- 規格的 `text unique`：一般 unique index（null 可重複，不需要 partial）；
-- 不用 partial 是因為 PostgREST upsert onConflict=google_place_id 需要非 partial 的 unique。
create unique index if not exists campsites_google_place_id_key
  on public.campsites (google_place_id);

alter table public.camping_trips
  add column if not exists merged_into_id bigint
    references public.camping_trips(id) on delete set null;

commit;

-- rollback:
-- 只在還沒有任何程式寫入這些欄位、或確定可丟棄其內容時使用。整段取消註解、貼進 SQL Editor 執行。
-- begin;
-- alter table public.camping_trips drop column if exists merged_into_id;
-- drop index if exists public.campsites_google_place_id_key;
-- alter table public.campsites
--   drop column if exists merged_into_id,
--   drop column if exists field_sources,
--   drop column if exists business_status,
--   drop column if exists google_maps_url,
--   drop column if exists address,
--   drop column if exists google_place_id;
-- commit;
