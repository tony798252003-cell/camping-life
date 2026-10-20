-- 20261020_rls_check.sql
-- 套用 20261020000000_enable_rls_core_tables.sql 之後，在 Supabase SQL Editor 執行的唯讀檢查。
-- 全部都是 SELECT，或包在 begin; ... rollback; 裡，不會留下任何變更。
--
-- 執行方式：
--   A 區（1~5）：可以整段一起跑，每個查詢看結果。
--   B 區（角色模擬）：每個 begin; ... rollback; 區塊「單獨選取後執行」（Run selected）。
--     預期「permission denied」的區塊報錯就代表通過；報錯後交易已中止，不會有任何寫入。
--
-- 先取得兩個 uuid，填進 B 區的 <MAIN_USER_UUID>、<WIFE_USER_UUID>：
--   select id, is_admin, family_id from public.profiles;            -- is_admin = true 的是主帳號
--   select user_id, count(*) from public.camping_trips group by 1;  -- 52 筆的 user_id 也是主帳號
--   太太帳號 = family_id 與主帳號相同、id 不同的那一列（若有兩個候選，用 B 區分別測）

-- =====================================================================
-- A 區：結構檢查
-- =====================================================================

-- 1. RLS 狀態：9 張表 rls_enabled 都必須是 true
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('calendar_events','camping_gear','camping_trips','campsites','cpbl_schedule',
                    'families','profiles','system_assets','trip_photos')
order by 1;

-- 2. 每張表的 policy。不應再出現 qual = 'true' 的 camping_trips / camping_gear / trip_photos policy
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 3. 表層級權限：6 張表的 anon 應該完全沒有列；authenticated 不應有 TRUNCATE/REFERENCES/TRIGGER；
--    profiles 的 authenticated 只剩 SELECT（INSERT/UPDATE 改成欄位層級，見 4）
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- 4. profiles 欄位層級權限：is_admin、family_id 只能有 SELECT；
--    id/updated_at/location_name/latitude/longitude/onboarding_completed_at/campsite_quick_chips 有 SELECT, INSERT, UPDATE
select column_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon', 'authenticated')
group by column_name, grantee
order by column_name, grantee;

-- 5. 不會報錯的權限摘要（預期：anon 全部 false；authenticated 的 select 全部 true；
--    profiles 的 is_admin/family_id update 為 false）
select t as table_name,
       has_table_privilege('anon', 'public.' || t, 'SELECT')          as anon_select,
       has_table_privilege('anon', 'public.' || t, 'INSERT')          as anon_insert,
       has_table_privilege('anon', 'public.' || t, 'UPDATE')          as anon_update,
       has_table_privilege('anon', 'public.' || t, 'DELETE')          as anon_delete,
       has_table_privilege('authenticated', 'public.' || t, 'SELECT') as auth_select,
       has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE') as auth_truncate
from unnest(array['camping_trips','camping_gear','campsites','families','profiles','trip_photos']) as t
order by 1;

select has_column_privilege('authenticated', 'public.profiles', 'is_admin',  'UPDATE') as can_update_is_admin,   -- 預期 false
       has_column_privilege('authenticated', 'public.profiles', 'family_id', 'UPDATE') as can_update_family_id,  -- 預期 false
       has_column_privilege('authenticated', 'public.profiles', 'is_admin',  'INSERT') as can_insert_is_admin,   -- 預期 false
       has_column_privilege('authenticated', 'public.profiles', 'location_name', 'UPDATE') as can_update_location; -- 預期 true

-- 6. 資料參考值（以 postgres 身分，不受 RLS 影響），給 B 區比對預期數字
select 'trips_total' as k, count(*) from public.camping_trips
union all select 'trips_family_id_null', count(*) from public.camping_trips where family_id is null
union all select 'gear_total', count(*) from public.camping_gear
union all select 'gear_family_id_null', count(*) from public.camping_gear where family_id is null
union all select 'events_total', count(*) from public.calendar_events
union all select 'events_with_family_id', count(*) from public.calendar_events where family_id is not null
union all select 'campsites_total', count(*) from public.campsites
union all select 'trip_photos_total', count(*) from public.trip_photos;

-- =====================================================================
-- B 區：角色模擬（每個區塊單獨執行）
-- =====================================================================

-- B1. anon 讀行程 → 預期 ERROR: permission denied for table camping_trips
begin;
set local role anon;
select count(*) from public.camping_trips;
rollback;

-- B2. anon 讀 profiles → 預期 ERROR: permission denied for table profiles
begin;
set local role anon;
select count(*) from public.profiles;
rollback;

-- B3. anon 讀營區 → 預期 ERROR: permission denied for table campsites
begin;
set local role anon;
select count(*) from public.campsites;
rollback;

-- B4. 主帳號可見資料 → 預期 trips = 52、gear = 4（gear_total）、events = 54、profiles = 1、
--     families = 1、campsites = campsites_total、trip_photos = 0
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<MAIN_USER_UUID>","role":"authenticated"}', true);
select 'trips' as k, count(*) from public.camping_trips
union all select 'gear', count(*) from public.camping_gear
union all select 'events', count(*) from public.calendar_events
union all select 'profiles', count(*) from public.profiles
union all select 'families', count(*) from public.families
union all select 'campsites', count(*) from public.campsites
union all select 'trip_photos', count(*) from public.trip_photos;
rollback;

-- B5. 太太帳號可見資料（經由家庭）→ 預期 trips = 52、gear = 4、
--     events = events_with_family_id（與套用前相同，calendar_events 本次沒動）、profiles = 1、families = 1
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<WIFE_USER_UUID>","role":"authenticated"}', true);
select 'trips' as k, count(*) from public.camping_trips
union all select 'trips_via_app_filter', count(*) from public.camping_trips
          where family_id = (select family_id from public.profiles where id = auth.uid())
union all select 'gear', count(*) from public.camping_gear
union all select 'events', count(*) from public.calendar_events
union all select 'profiles', count(*) from public.profiles
union all select 'families', count(*) from public.families;
rollback;

-- B6. 不屬於任何家庭的陌生 uuid → 預期全部 0（campsites 除外：登入者都看得到營區）
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
select 'trips' as k, count(*) from public.camping_trips
union all select 'gear', count(*) from public.camping_gear
union all select 'profiles', count(*) from public.profiles
union all select 'families', count(*) from public.families
union all select 'trip_photos', count(*) from public.trip_photos;
rollback;

-- B7. 主帳號嘗試把自己設成 admin → 預期 ERROR: permission denied for table profiles
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<MAIN_USER_UUID>","role":"authenticated"}', true);
update public.profiles set is_admin = true where id = auth.uid();
rollback;

-- B8. 太太帳號嘗試改自己的 family_id → 預期 ERROR: permission denied for table profiles
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<WIFE_USER_UUID>","role":"authenticated"}', true);
update public.profiles set family_id = null where id = auth.uid();
rollback;

-- B9. 設定頁「儲存出發點」的 upsert（模擬 PostgREST 產生的 SQL）→ 預期 INSERT 0 1 成功，然後 rollback 不留變更
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<MAIN_USER_UUID>","role":"authenticated"}', true);
insert into public.profiles (id, location_name, latitude, longitude, updated_at)
select id, location_name, latitude, longitude, now() from public.profiles where id = auth.uid()
on conflict (id) do update set id = excluded.id, location_name = excluded.location_name,
  latitude = excluded.latitude, longitude = excluded.longitude, updated_at = excluded.updated_at;
rollback;

-- B10. 營區快速篩選 chips 儲存（CampsiteLibrary）→ 預期 UPDATE 1，然後 rollback
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<MAIN_USER_UUID>","role":"authenticated"}', true);
update public.profiles set campsite_quick_chips = campsite_quick_chips where id = auth.uid();
rollback;
