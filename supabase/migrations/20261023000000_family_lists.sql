-- 20261023000000_family_lists.sql
-- F2 家庭共用清單（docs/superpowers/specs/2026-10-22-family-f2-lists-anniversary-design.md）：
--   family_lists（清單）、family_list_items（項目），同家庭成員可讀寫，並開啟 Realtime。
-- 使用方式：先跑 `npx tsx scripts/backup/backup-all.ts`（exit 0），再整份貼進 Supabase SQL Editor 執行
--           （begin/commit 包住，任何一行失敗就整份不生效）。只新增物件、不動任何既有資料。需使用者同意後才能套用正式庫。
-- 前提：20261020000000_enable_rls_core_tables.sql（user_family_id()）、20261022000000_family_calendar_rls.sql 已套用。
-- 套用後：再跑 `npm run db:types`（src/types/supabase.ts 目前是手動補入這兩張表）。
-- 設計取捨：
--   * unique (family_id, title)：「家庭沒有任何清單才建立預設三張」在兩支手機同時載入時可能雙建，
--     前端以 upsert ignoreDuplicates 搭配此唯一鍵擋掉；副作用是同家庭不能有兩張同名清單。
--   * WITH CHECK：update/insert 後的列仍須屬於自己的家庭，清單不能被搬到別的家庭、
--     項目不能被搬到別家庭的清單。
--   * created_by / done_by 只記錄用，不參與權限（同家庭成員都能改刪）。

begin;

-- ---------------------------------------------------------------------------
-- 1. 資料表
-- ---------------------------------------------------------------------------
create table public.family_lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint family_lists_family_title_key unique (family_id, title)
);

create table public.family_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.family_lists(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  done_by uuid references auth.users(id) on delete set null,
  done_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- family_lists 的 (family_id, title) 唯一鍵已涵蓋 family_id 查詢；items 以 list_id 查詢
create index family_list_items_list_id_idx on public.family_list_items (list_id);

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------
alter table public.family_lists enable row level security;
alter table public.family_list_items enable row level security;

create policy "Family members can view lists" on public.family_lists
  for select to authenticated using (family_id = public.user_family_id());
create policy "Family members can insert lists" on public.family_lists
  for insert to authenticated with check (family_id = public.user_family_id());
create policy "Family members can update lists" on public.family_lists
  for update to authenticated
  using (family_id = public.user_family_id())
  with check (family_id = public.user_family_id());
create policy "Family members can delete lists" on public.family_lists
  for delete to authenticated using (family_id = public.user_family_id());

create policy "Family members can view list items" on public.family_list_items
  for select to authenticated using (
    exists (select 1 from public.family_lists l
            where l.id = list_id and l.family_id = public.user_family_id())
  );
create policy "Family members can insert list items" on public.family_list_items
  for insert to authenticated with check (
    exists (select 1 from public.family_lists l
            where l.id = list_id and l.family_id = public.user_family_id())
  );
create policy "Family members can update list items" on public.family_list_items
  for update to authenticated
  using (
    exists (select 1 from public.family_lists l
            where l.id = list_id and l.family_id = public.user_family_id())
  )
  with check (
    exists (select 1 from public.family_lists l
            where l.id = list_id and l.family_id = public.user_family_id())
  );
create policy "Family members can delete list items" on public.family_list_items
  for delete to authenticated using (
    exists (select 1 from public.family_lists l
            where l.id = list_id and l.family_id = public.user_family_id())
  );

-- ---------------------------------------------------------------------------
-- 3. 權限：與 20261020 一致——anon 完全沒有、authenticated 不給 TRUNCATE / REFERENCES / TRIGGER
-- ---------------------------------------------------------------------------
revoke all on table public.family_lists, public.family_list_items from anon;
revoke truncate, references, trigger on table public.family_lists, public.family_list_items from authenticated;
grant select, insert, update, delete on table public.family_lists, public.family_list_items to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Realtime（已在 publication 內就略過，可重複執行）
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['family_lists', 'family_list_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- 回滾（會刪掉清單資料，先備份）：
-- ---------------------------------------------------------------------------
-- begin;
-- alter publication supabase_realtime drop table public.family_list_items;
-- alter publication supabase_realtime drop table public.family_lists;
-- drop table public.family_list_items;
-- drop table public.family_lists;
-- commit;
