-- 20261020_rls_check.sql
-- 套用 20261020000000_enable_rls_core_tables.sql 之後，在 Supabase SQL Editor 執行的檢查。不會留下任何變更。
--
-- 使用方式（重要）：
--   Supabase SQL Editor 只顯示「最後一個 statement」的結果，所以每個區塊都設計成「最後一句就是答案」。
--   一次只跑一個區塊：反白這段（從「-- [Ax]/[Bx]」標題下一行到下一個標題前）→ Run → 截圖。
--   不要整份一起 Run。
--   A 區：唯讀查詢。
--   B 區：角色模擬。一個區塊會被當成一個交易執行，`set local` 只在這個區塊內有效，執行完就自動還原。
--         寫入測試（B5~B8）用 DO 區塊，最後一定 raise exception：訊息就是結果，而且整段都會回滾，不會寫進去。
--         看到紅色 ERROR 不代表失敗，請比對每個區塊寫的「預期」。
--
-- 準備：先跑 [A0] 取得兩個 uuid，把 B 區所有 <MAIN_USER_UUID>、<WIFE_USER_UUID> 替換掉
-- （SQL Editor 可用 Cmd+F → 取代）。

-- =====================================================================
-- A 區：結構檢查（唯讀）
-- =====================================================================

-- [A0] 找出主帳號與太太帳號的 uuid
--   預期：is_admin = true、trips = 52 的那列是主帳號；family_id 相同、trips = 0 的是太太（若有兩個候選，B3 分別測）
select p.id, p.is_admin, p.family_id,
       (select count(*) from public.camping_trips t where t.user_id = p.id) as trips
from public.profiles p
order by trips desc;

-- [A1] RLS 狀態　預期：9 列，rls_enabled 全部 true
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('calendar_events','camping_gear','camping_trips','campsites','cpbl_schedule',
                    'families','profiles','system_assets','trip_photos')
order by 1;

-- [A2] 所有 policy　預期：camping_trips / camping_gear / trip_photos 沒有 qual = 'true' 的 policy；
--      profiles 有 3 條；camping_gear 有 "View family members gear"
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- [A3] 表層級權限　預期：camping_gear/camping_trips/campsites/families/profiles/trip_photos 沒有 anon 列；
--      所有表都沒有 TRUNCATE、REFERENCES、TRIGGER；profiles 的 authenticated 只有 SELECT
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- [A4] profiles 欄位層級權限　預期：is_admin、family_id 只有 SELECT；
--      其他 7 欄（id、updated_at、location_name、latitude、longitude、onboarding_completed_at、campsite_quick_chips）
--      有 INSERT, SELECT, UPDATE
select column_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon', 'authenticated')
group by column_name, grantee
order by column_name, grantee;

-- [A5] 權限摘要（一列一張表）　預期：anon_* 全部 false；auth_select 全部 true；auth_truncate 全部 false；
--      profiles 那列的 auth_update_is_admin、auth_update_family_id 為 false，auth_update_location 為 true
select t as table_name,
       has_table_privilege('anon', 'public.' || t, 'SELECT')            as anon_select,
       has_table_privilege('anon', 'public.' || t, 'INSERT')            as anon_insert,
       has_table_privilege('anon', 'public.' || t, 'UPDATE')            as anon_update,
       has_table_privilege('anon', 'public.' || t, 'DELETE')            as anon_delete,
       has_table_privilege('authenticated', 'public.' || t, 'SELECT')   as auth_select,
       has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE') as auth_truncate,
       case when t = 'profiles' then has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE') end      as auth_update_is_admin,
       case when t = 'profiles' then has_column_privilege('authenticated', 'public.profiles', 'family_id', 'UPDATE') end     as auth_update_family_id,
       case when t = 'profiles' then has_column_privilege('authenticated', 'public.profiles', 'location_name', 'UPDATE') end as auth_update_location
from unnest(array['camping_trips','camping_gear','campsites','families','profiles','trip_photos']) as t
order by 1;

-- [A6] 函式 EXECUTE 權限　預期：
--      user_family_id、family_member_ids：authenticated = true（絕對不能是 false，否則行程/裝備全壞）
--      family_member_ids：anon = false
--      get_family_by_invite、get_family_by_invite_code、kick_family_member、leave_family：anon 與 authenticated 都 false
select f as function_name,
       has_function_privilege('anon', f, 'EXECUTE')          as anon_execute,
       has_function_privilege('authenticated', f, 'EXECUTE') as authenticated_execute
from unnest(array['public.user_family_id()', 'public.family_member_ids()', 'public.get_family_members()',
                  'public.get_family_by_invite(text)', 'public.get_family_by_invite_code(text)',
                  'public.kick_family_member(uuid)', 'public.leave_family()']) as f;

-- [A7] 資料參考值（postgres 身分，不受 RLS 影響），B 區的預期數字以這裡為準
select (select count(*) from public.camping_trips)                                    as trips_total,
       (select count(*) from public.camping_trips where family_id is null)            as trips_family_id_null,
       (select count(*) from public.camping_gear)                                     as gear_total,
       (select count(*) from public.camping_gear where family_id is null)             as gear_family_id_null,
       (select count(*) from public.calendar_events)                                  as events_total,
       (select count(*) from public.calendar_events where family_id is not null)      as events_with_family_id,
       (select count(*) from public.campsites)                                        as campsites_total,
       (select count(*) from public.trip_photos)                                      as trip_photos_total;

-- =====================================================================
-- B 區：角色模擬（每個區塊單獨反白執行）
-- =====================================================================

-- [B1] anon（未登入）存取 6 張表
--   預期：ERROR 訊息為「B1 結果: camping_trips=denied, camping_gear=denied, campsites=denied,
--         families=denied, profiles=denied, trip_photos=denied」（全部 denied 才算通過）
set local role anon;
do $$
declare t text; r text := ''; n bigint;
begin
  foreach t in array array['camping_trips','camping_gear','campsites','families','profiles','trip_photos'] loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      r := r || t || '=READABLE(' || n || '), ';
    exception when insufficient_privilege then
      r := r || t || '=denied, ';
    end;
  end loop;
  raise exception 'B1 結果: %', rtrim(r, ', ');
end $$;

-- [B2] 主帳號能看到的資料
--   預期：trips = 52、gear = 4（= A7 gear_total）、events = 54、profiles = 1、families = 1、
--         campsites = A7 campsites_total、photos_visible = A7 trip_photos_total（現有照片都屬於主帳號或家庭行程）
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<MAIN_USER_UUID>","role":"authenticated"}', true);
select (select count(*) from public.camping_trips)   as trips,
       (select count(*) from public.camping_gear)    as gear,
       (select count(*) from public.calendar_events) as events,
       (select count(*) from public.profiles)        as profiles,
       (select count(*) from public.families)        as families,
       (select count(*) from public.campsites)       as campsites,
       (select count(*) from public.trip_photos)     as photos_visible;

-- [B3] 太太帳號能看到的資料（經由家庭）
--   預期：trips = 52、trips_via_app_filter = 52、gear = 4（= A7 gear_total，含 family_id 為 null 的）、
--         events = A7 events_with_family_id（calendar_events 本次沒動，與套用前相同）、profiles = 1、families = 1
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<WIFE_USER_UUID>","role":"authenticated"}', true);
select (select count(*) from public.camping_trips)   as trips,
       (select count(*) from public.camping_trips
          where family_id = (select family_id from public.profiles where id = auth.uid())) as trips_via_app_filter,
       (select count(*) from public.camping_gear)    as gear,
       (select count(*) from public.calendar_events) as events,
       (select count(*) from public.profiles)        as profiles,
       (select count(*) from public.families)        as families;

-- [B4] 不屬於任何家庭的陌生 uuid
--   預期：trips、gear、events、profiles、families、trip_photos 全部 0（campsites 登入者都看得到，所以不列）
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
select (select count(*) from public.camping_trips)   as trips,
       (select count(*) from public.camping_gear)    as gear,
       (select count(*) from public.calendar_events) as events,
       (select count(*) from public.profiles)        as profiles,
       (select count(*) from public.families)        as families,
       (select count(*) from public.trip_photos)     as trip_photos;

-- [B5] 主帳號嘗試把 is_admin 設為 true（提權）
--   預期：ERROR「B5 OK: permission denied（預期）」
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<MAIN_USER_UUID>","role":"authenticated"}', true);
do $$
begin
  update public.profiles set is_admin = true where id = auth.uid();
  raise exception 'B5 FAIL: 可以改 is_admin（已回滾，請回報）';
exception when insufficient_privilege then
  raise exception 'B5 OK: permission denied（預期）';
end $$;

-- [B6] 太太帳號嘗試改自己的 family_id
--   預期：ERROR「B6 OK: permission denied（預期）」
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<WIFE_USER_UUID>","role":"authenticated"}', true);
do $$
begin
  update public.profiles set family_id = null where id = auth.uid();
  raise exception 'B6 FAIL: 可以改 family_id（已回滾，請回報）';
exception when insufficient_privilege then
  raise exception 'B6 OK: permission denied（預期）';
end $$;

-- [B7] 設定頁「儲存出發點」：模擬 PostgREST upsert 產生的 SQL（值沿用目前的值）
--   預期：ERROR「B7 OK: 1 row(s)（刻意回滾）」。若是 permission denied 或 row-level security，代表儲存出發點會壞
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<MAIN_USER_UUID>","role":"authenticated"}', true);
do $$
declare payload json; n int;
begin
  select json_agg(json_build_object('id', auth.uid(), 'location_name', p.location_name,
                                    'latitude', p.latitude, 'longitude', p.longitude, 'updated_at', now()))
    into payload
    from (select 1) x left join public.profiles p on p.id = auth.uid();
  insert into public.profiles (id, latitude, location_name, longitude, updated_at)
  select pgrst_body.id, pgrst_body.latitude, pgrst_body.location_name, pgrst_body.longitude, pgrst_body.updated_at
  from json_populate_recordset(null::public.profiles, payload) as pgrst_body
  on conflict (id) do update set id = excluded.id, latitude = excluded.latitude,
    location_name = excluded.location_name, longitude = excluded.longitude, updated_at = excluded.updated_at;
  get diagnostics n = row_count;
  raise exception 'B7 OK: % row(s)（刻意回滾）', n;
end $$;

-- [B8] 營區庫快速篩選 chips 儲存（CampsiteLibrary）
--   預期：ERROR「B8 OK: 1 row(s)（刻意回滾）」
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<MAIN_USER_UUID>","role":"authenticated"}', true);
do $$
declare n int;
begin
  update public.profiles set campsite_quick_chips = campsite_quick_chips where id = auth.uid();
  get diagnostics n = row_count;
  raise exception 'B8 OK: % row(s)（刻意回滾）', n;
end $$;
