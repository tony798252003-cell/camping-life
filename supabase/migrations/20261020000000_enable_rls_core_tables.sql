-- 20261020000000_enable_rls_core_tables.sql
-- 緊急安全修正：5 張核心表啟用 RLS、關閉 anon 存取、防止使用者自行改 profiles.is_admin / family_id。
-- 使用方式：整份貼進 Supabase SQL Editor 執行（begin/commit 包住，任何一行失敗就整份不生效）。
-- 套用前先跑 `npx tsx scripts/backup/backup-all.ts`，exit 0 才繼續；套用後跑 supabase/verify/20261020_rls_check.sql。
-- 不刪任何資料列；不動 cpbl_schedule、calendar_events、system_assets 的 policy。
-- 詳細理由見 .superpowers/sdd/2026-10-17-life-calendar-redesign/task-1.7-report.md

begin;

-- ---------------------------------------------------------------------------
-- 1. 移除 USING (true) 的寬鬆 policy（名稱與 baseline 完全一致）
-- ---------------------------------------------------------------------------
drop policy if exists "Public Access"                       on public.camping_trips;
drop policy if exists "Enable read access for all users"    on public.camping_trips;
drop policy if exists "Enable insert access for all users"  on public.camping_trips;
drop policy if exists "Enable update access for all users"  on public.camping_trips;
drop policy if exists "Enable delete access for all users"  on public.camping_trips;
drop policy if exists "Enable all access for all users"     on public.camping_gear;
drop policy if exists "Enable all access for now"           on public.trip_photos;
drop policy if exists "Users can view photos of their families or own photos" on public.trip_photos;

-- 保留的既有 policy（不重建）：
--   camping_trips: Users can view/insert/update/delete own trips, View family trips, Update family trips
--   camping_gear:  Users can view/insert/update/delete own gear, View family gear
--   campsites:     Public can view campsites (SELECT), Authenticated users can insert campsites,
--                  Allow authenticated users to update campsites（無 DELETE policy → 前端不能刪營區）
--   families:      Users can view their own family, Users can create family
--   trip_photos:   insert/delete own（兩組同義的重複 policy，留待之後清理）

-- ---------------------------------------------------------------------------
-- 2. 新增缺少的 policy
-- ---------------------------------------------------------------------------
-- profiles：完全沒有 policy。只能看/建/改自己那一列；不給 DELETE。
-- calendar_events、system_assets 的 policy 會 sub-select profiles，靠這條 select-own 才能繼續運作。
create policy "Users can view own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "Users can insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "Users can update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- trip_photos：取代兩條 USING (true)。自己的照片，或同家庭行程的照片。
create policy "Users can view own or family trip photos" on public.trip_photos
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.camping_trips t
      where t.id = trip_photos.trip_id
        and t.family_id is not null
        and t.family_id = public.user_family_id()
    )
  );

-- camping_gear：前端新增裝備時從不寫 family_id（GearROIView / TentManagement），
-- 所以加入家庭之後新增的裝備 family_id 會是 null，"View family gear" 看不到。
-- 今天 RLS 關閉時家人看得到所有裝備（行程卡片的帳篷 embed、TripModal 裝備清單），
-- 為了維持「家人看得到家庭裝備」，改以「擁有者是同家庭成員」判斷。
-- 用專用的 family_member_ids()（只回 profiles.id，不碰 auth.users、不回 email），
-- 不重用 get_family_members()。沒有家庭時回傳空集合。
-- ⚠ authenticated 對 family_member_ids() 與 user_family_id() 的 EXECUTE 絕對不能收回：
--   policy 以呼叫者身分執行這兩個函式，收回後所有 camping_gear / camping_trips / trip_photos /
--   families 查詢（含行程列表的 camping_gear!tent_id embed）都會 permission denied。
create function public.family_member_ids() returns setof uuid
  language sql stable security definer
  set search_path = ''
  as $$
    select p.id from public.profiles p
    where p.family_id is not null
      and p.family_id = (select me.family_id from public.profiles me where me.id = auth.uid())
  $$;
revoke execute on function public.family_member_ids() from public, anon;
grant execute on function public.family_member_ids() to authenticated;

create policy "View family members gear" on public.camping_gear
  for select to authenticated using (
    user_id in (select public.family_member_ids())
  );

-- ---------------------------------------------------------------------------
-- 3. 權限：關閉 anon；authenticated 拿掉會繞過 RLS 的 TRUNCATE 等
-- ---------------------------------------------------------------------------
-- 登入前沒有任何資料表存取（router guard 未登入一律導到 /auth，LoginView 只呼叫 signInWithOAuth）。
revoke all on table public.camping_trips, public.camping_gear, public.campsites,
                    public.families, public.profiles, public.trip_photos from anon;
revoke all on sequence public.camping_trips_id_seq, public.camping_gear_id_seq,
                       public.campsites_id_seq, public.trip_photos_id_seq from anon;

-- TRUNCATE 不受 RLS 約束；REFERENCES / TRIGGER 前端用不到。
revoke truncate, references, trigger on table public.camping_trips, public.camping_gear,
       public.campsites, public.families, public.profiles, public.trip_photos from authenticated;

-- profiles 防提權：收回表層級 INSERT/UPDATE/DELETE，只把前端會寫的欄位逐欄授權。
-- 刻意不含 is_admin、family_id：前端從不寫這兩欄（家庭加入/退出/踢人走 SECURITY DEFINER RPC 或已移除）。
-- id 必須在 UPDATE 清單中：PostgREST upsert 產生 ON CONFLICT (id) DO UPDATE SET id = excluded.id, ...；
-- 改 id 被上面的 with check (id = auth.uid()) 擋住。SELECT 保留表層級（RLS 只回自己那列）。
revoke insert, update, delete on table public.profiles from authenticated;
grant insert (id, updated_at, location_name, latitude, longitude, onboarding_completed_at, campsite_quick_chips)
  on public.profiles to authenticated;
grant update (id, updated_at, location_name, latitude, longitude, onboarding_completed_at, campsite_quick_chips)
  on public.profiles to authenticated;

-- 其餘 3 張表（RLS 已啟用、policy 不動）只收回會繞過 RLS 的 TRUNCATE 與用不到的 REFERENCES/TRIGGER。
revoke truncate, references, trigger on table public.calendar_events, public.system_assets,
       public.cpbl_schedule from anon, authenticated;

-- 家庭 RPC：前端（main 與 redesign/m1）沒有任何 .rpc() 呼叫，家庭 UI 已在 M0 移除。
-- 函式預設 EXECUTE 給 PUBLIC，所以要從 public、anon、authenticated 都收回。
-- get_family_by_invite(_code) 對 anon 會洩漏 family id、名稱、邀請碼、created_by。
-- 之後重做家庭分享時再依新設計授權。
-- 不動 user_family_id()、get_family_members()（policy / 既有授權依賴）。
revoke execute on function public.get_family_by_invite(code text),
                           public.get_family_by_invite_code(code_input text),
                           public.kick_family_member(target_user_id uuid),
                           public.leave_family()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. 啟用 RLS（trip_photos 已啟用）
-- ---------------------------------------------------------------------------
alter table public.camping_trips enable row level security;
alter table public.camping_gear  enable row level security;
alter table public.campsites     enable row level security;
alter table public.families      enable row level security;
alter table public.profiles      enable row level security;

commit;

-- rollback:
-- 緊急回復「今天（套用前）」的行為。整段取消註解、貼進 SQL Editor 執行。
-- 注意：這會重新打開 anon 全權存取，只在 App 壞掉、需要先恢復使用時用，修好後要重新套用本 migration。
-- begin;
-- alter table public.camping_trips disable row level security;
-- alter table public.camping_gear  disable row level security;
-- alter table public.campsites     disable row level security;
-- alter table public.families      disable row level security;
-- alter table public.profiles      disable row level security;
-- drop policy if exists "Users can view own profile" on public.profiles;
-- drop policy if exists "Users can insert own profile" on public.profiles;
-- drop policy if exists "Users can update own profile" on public.profiles;
-- drop policy if exists "Users can view own or family trip photos" on public.trip_photos;
-- drop policy if exists "View family members gear" on public.camping_gear;
-- drop function if exists public.family_member_ids();
-- grant execute on function public.get_family_by_invite(code text),
--                           public.get_family_by_invite_code(code_input text),
--                           public.kick_family_member(target_user_id uuid),
--                           public.leave_family()
--   to public, anon, authenticated;
-- grant truncate, references, trigger on table public.calendar_events, public.system_assets,
--       public.cpbl_schedule to anon, authenticated;
-- create policy "Public Access" on public.camping_trips using (true);
-- create policy "Enable read access for all users" on public.camping_trips for select using (true);
-- create policy "Enable insert access for all users" on public.camping_trips for insert with check (true);
-- create policy "Enable update access for all users" on public.camping_trips for update using (true);
-- create policy "Enable delete access for all users" on public.camping_trips for delete using (true);
-- create policy "Enable all access for all users" on public.camping_gear using (true) with check (true);
-- create policy "Enable all access for now" on public.trip_photos for select using (true);
-- create policy "Users can view photos of their families or own photos" on public.trip_photos for select using (true);
-- grant all on table public.camping_trips, public.camping_gear, public.campsites,
--                    public.families, public.profiles, public.trip_photos to anon, authenticated;
-- grant all on sequence public.camping_trips_id_seq, public.camping_gear_id_seq,
--                       public.campsites_id_seq, public.trip_photos_id_seq to anon;
-- revoke insert (id, updated_at, location_name, latitude, longitude, onboarding_completed_at, campsite_quick_chips) on public.profiles from authenticated;
-- revoke update (id, updated_at, location_name, latitude, longitude, onboarding_completed_at, campsite_quick_chips) on public.profiles from authenticated;
-- commit;
