-- 20261030000000_campsite_favorites.sql
-- 營區「最愛」，全家共用（2026-10-25 使用者同意）：campsite_favorites 一列＝某家庭把某營區加入最愛。
-- 使用方式：先跑 `npx tsx scripts/backup/backup-all.ts`（exit 0），再整份貼進 Supabase SQL Editor 執行
--           （begin/commit 包住，任何一行失敗就整份不生效）。只新增物件、不動任何既有資料。需使用者同意後才能套用正式庫。
-- 前提：20261020000000_enable_rls_core_tables.sql（user_family_id()）已套用。
-- 套用後：再跑 `npm run db:types`（src/types/supabase.ts 目前是手動補入這張表）。
-- 設計取捨：
--   * primary key (family_id, campsite_id)：同家庭同營區只會有一列，兩人同時按也不會重複。
--   * 沒有 update：最愛只有加／取消兩種動作，因此不開 update policy 也不 grant update。
--   * created_by 只記錄用，不參與權限（同家庭成員都能取消別人加的最愛）。

begin;

-- ---------------------------------------------------------------------------
-- 1. 資料表
-- ---------------------------------------------------------------------------
create table public.campsite_favorites (
  family_id uuid not null references public.families(id) on delete cascade,
  campsite_id bigint not null references public.campsites(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (family_id, campsite_id)
);

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------
alter table public.campsite_favorites enable row level security;

create policy "Family members can view campsite favorites" on public.campsite_favorites
  for select to authenticated using (family_id = public.user_family_id());
create policy "Family members can insert campsite favorites" on public.campsite_favorites
  for insert to authenticated with check (family_id = public.user_family_id());
create policy "Family members can delete campsite favorites" on public.campsite_favorites
  for delete to authenticated using (family_id = public.user_family_id());

-- ---------------------------------------------------------------------------
-- 3. 權限：與 20261020 一致——anon 完全沒有、authenticated 只給用得到的
-- ---------------------------------------------------------------------------
revoke all on table public.campsite_favorites from anon;
revoke update, truncate, references, trigger on table public.campsite_favorites from authenticated;
grant select, insert, delete on table public.campsite_favorites to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- 回滾（會刪掉最愛資料，先備份）：
-- ---------------------------------------------------------------------------
-- begin;
-- drop table public.campsite_favorites;
-- commit;
