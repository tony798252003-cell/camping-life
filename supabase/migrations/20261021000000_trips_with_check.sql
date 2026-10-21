-- 20261021000000_trips_with_check.sql
-- Task 5-6（2026-10-20 安全審查 I3、M3 延後項）：行程寫入加上 WITH CHECK。
-- 問題：camping_trips 的 UPDATE policy 沒有 WITH CHECK，同家庭成員可以把行程的 family_id 改掉
--       （搬出家庭，主帳號從列表消失）或注入別的家庭；INSERT 也可以帶任意 family_id；
--       trip_photos INSERT 只檢查 user_id，可以把照片掛到別人的行程。
-- 使用方式：先跑 `npx tsx scripts/backup/backup-all.ts`（exit 0），再整份貼進 Supabase SQL Editor 執行
--           （begin/commit 包住，任何一行失敗就整份不生效）。不刪任何資料列。
-- 前提：20261020000000_enable_rls_core_tables.sql 已套用。
-- 前提查證（2026-10-20）：正式庫 52 筆行程的 family_id 全部等於主帳號目前的 family_id（12e2bcef…）。
--   套用前再確認一次，結果必須為 0（否則「own update」的 WITH CHECK 會讓 family_id 與主帳號不一致的行程無法編輯）：
--     select count(*) from camping_trips t join profiles p on p.id = t.user_id
--     where t.family_id is distinct from p.family_id;

begin;

-- 1. camping_trips UPDATE：own（名稱沿用 baseline）
--    USING 不變；WITH CHECK：仍是自己的行程，且 family_id 只能是 null→null 或等於自己目前的家庭。
alter policy "Users can update own trips" on public.camping_trips
  with check (auth.uid() = user_id and family_id is not distinct from public.user_family_id());

-- 2. camping_trips UPDATE：family（名稱沿用 baseline）
--    更新後 family_id 必須仍是自己的家庭（不能搬出去、不能注入別的家庭）。
alter policy "Update family trips" on public.camping_trips
  with check (family_id = public.user_family_id());

-- 3. camping_trips INSERT：own
--    family_id 只能是 null 或自己的家庭。
alter policy "Users can insert own trips" on public.camping_trips
  with check (
    auth.uid() = user_id
    and (family_id is null or family_id = public.user_family_id())
  );

-- 4. trip_photos INSERT：baseline 有兩條同義的重複 policy（permissive 是 OR，留一條寬鬆的就等於沒擋），
--    兩條都 drop，重建成一條：自己的照片，且 trip 必須是自己看得到的行程（own 或同家庭）。
drop policy if exists "Enable insert for owners"            on public.trip_photos;
drop policy if exists "Users can insert their own photos"   on public.trip_photos;
create policy "Users can insert photos to visible trips" on public.trip_photos
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.camping_trips t
      where t.id = trip_photos.trip_id
        and (
          t.user_id = auth.uid()
          or (t.family_id is not null and t.family_id = public.user_family_id())
        )
    )
  );

commit;

-- ---------------------------------------------------------------------------
-- rollback（使用者手動執行，不會自動跑）
-- ---------------------------------------------------------------------------
-- begin;
-- alter policy 無法移除 WITH CHECK，所以用 drop + create 還原成沒有 WITH CHECK 的原樣：
-- drop policy "Users can update own trips" on public.camping_trips;
-- create policy "Users can update own trips" on public.camping_trips for update using (auth.uid() = user_id);
-- drop policy "Update family trips" on public.camping_trips;
-- create policy "Update family trips" on public.camping_trips for update
--   using (family_id is not null and family_id = public.user_family_id());
-- alter policy "Users can insert own trips" on public.camping_trips with check (auth.uid() = user_id);
-- drop policy "Users can insert photos to visible trips" on public.trip_photos;
-- create policy "Enable insert for owners" on public.trip_photos for insert with check (auth.uid() = user_id);
-- create policy "Users can insert their own photos" on public.trip_photos for insert with check (auth.uid() = user_id);
-- commit;
