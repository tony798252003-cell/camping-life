-- 20261017000300_calendar_categories.sql
-- Task 3.1：事件分類、全天事件日期欄位、visibility、show_cpbl，以及資料回填（規格 §6.2）。
-- 使用方式：先跑 `npx tsx scripts/backup/backup-all.ts`（exit 0），再整份貼進 Supabase SQL Editor。
-- 前提：20261020000000_enable_rls_core_tables.sql 已套用。全部只做加法，不刪任何資料。
-- 套用後：執行檔尾的「回填報告」，和舊畫面對照；再跑 `npm run db:types`。

begin;

-- ---------------------------------------------------------------------------
-- 1. event_categories（規格 §6.2；§17 S6：不加 system_key trigger）
-- ---------------------------------------------------------------------------
create table public.event_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  system_key text check (system_key in ('camping','baseball','work','family','personal')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, system_key),
  unique (owner_id, name)
);

alter table public.event_categories enable row level security;

create policy "Owner can select categories" on public.event_categories
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owner can insert categories" on public.event_categories
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owner can update categories" on public.event_categories
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- 露營、棒球為系統分類，不可刪除
create policy "Owner can delete non-system categories" on public.event_categories
  for delete to authenticated using (
    owner_id = (select auth.uid())
    and (system_key is null or system_key not in ('camping','baseball'))
  );

-- Supabase 預設會把新表的 ALL 給 anon / authenticated，要收回。
revoke all on table public.event_categories from anon;
grant select, insert, update, delete on table public.event_categories to authenticated;
revoke truncate, references, trigger on table public.event_categories from authenticated;

-- ---------------------------------------------------------------------------
-- 2. 新欄位
-- ---------------------------------------------------------------------------
-- calendar_events / camping_trips：authenticated 的權限是表層級（baseline GRANT ALL；
-- 20261020 只收回 truncate/references/trigger），新欄位自動涵蓋，不需要逐欄授權。
-- §17 S5：不加 check constraint，不加補 start_date 的 trigger。
alter table public.calendar_events
  add column category_id uuid references public.event_categories(id) on delete set null,
  add column start_date date,
  add column end_date date,
  add column visibility text not null default 'private' check (visibility in ('private','shared')),
  add column cpbl_game_id uuid references public.cpbl_schedule(id) on delete set null;

alter table public.camping_trips
  add column visibility text not null default 'private' check (visibility in ('private','shared'));

alter table public.profiles
  add column show_cpbl boolean not null default true;

-- profiles 在 20261020 改為「欄位層級」授權，新欄位不在清單內，必須補，否則設定頁的開關存不進去。
grant insert (show_cpbl), update (show_cpbl) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. 回填
-- ---------------------------------------------------------------------------
-- 回填 1：每個 profile 若「還沒有任何分類」就建立 5 個預設分類（sort_order 0..4）
insert into public.event_categories (owner_id, name, color, system_key, sort_order)
select p.id, d.name, d.color, d.system_key, d.sort_order
from public.profiles p
cross join (values
  ('露營', '#10b981', 'camping',   0),
  ('棒球', '#9d1c32', 'baseball',  1),
  ('工作', '#3b82f6', 'work',      2),
  ('家庭', '#f59e0b', 'family',    3),
  ('個人', '#8b5cf6', 'personal',  4)
) as d(name, color, system_key, sort_order)
where not exists (select 1 from public.event_categories c where c.owner_id = p.id);

-- 回填 2：全天事件的日期（台北時區）
update public.calendar_events
set start_date = (start_time at time zone 'Asia/Taipei')::date,
    end_date   = (end_time   at time zone 'Asia/Taipei')::date
where is_all_day;

-- 回填 3：分類。color like 'cpbl:%' → 棒球；其餘一律 個人（不用顏色猜分類）。
-- 保守解讀（規格未寫）：
--   (a) 分類的擁有者取 created_by（= 建立事件的使用者）；created_by 為 null 或該使用者沒有分類時，
--       category_id 留 null（前端以個人色顯示），不猜。
--   (b) 只處理 category_id 為 null 的事件，所以重跑不會覆蓋之後手動改過的分類。
update public.calendar_events e
set category_id = c.id
from public.event_categories c
where e.category_id is null
  and c.owner_id = e.created_by
  and c.system_key = case when e.color like 'cpbl:%' then 'baseball' else 'personal' end;

-- cpbl_game_id：color 格式為 'cpbl:<客隊>:<主隊>'；同一天（台北日期）、客隊主隊都相符才回填。
-- 保守解讀：恰好一場符合才填（雙重賽或隊名不符 → 留 null）。
update public.calendar_events e
set cpbl_game_id = m.game_id
from (
  select e2.id as event_id, (array_agg(s.id))[1] as game_id
  from public.calendar_events e2
  join public.cpbl_schedule s
    on s.game_date = (e2.start_time at time zone 'Asia/Taipei')::date
   and s.visiting_team_name = split_part(e2.color, ':', 2)
   and s.home_team_name     = split_part(e2.color, ':', 3)
  where e2.color like 'cpbl:%' and e2.cpbl_game_id is null
  group by e2.id
  having count(*) = 1
) m
where e.id = m.event_id;

commit;

-- ---------------------------------------------------------------------------
-- 使用者手動執行（不會自動跑）
-- ---------------------------------------------------------------------------
-- (1) 回填報告（套用後執行，和舊畫面對照）
-- select e.id, e.title, e.color old_color, c.name category, e.start_date, e.end_date, e.cpbl_game_id
-- from calendar_events e left join event_categories c on c.id = e.category_id order by e.start_time;
--
-- (2) 對齊 SQL（M3 PR 合併、正式站換成新前端之後執行一次；規格 §6.2）
-- update calendar_events set start_date = (start_time at time zone 'Asia/Taipei')::date,
--                            end_date   = (end_time   at time zone 'Asia/Taipei')::date
-- where is_all_day;

-- rollback:
-- 整段取消註解執行。只 drop 本次新增的東西；回填的資料隨欄位／表一起消失。
-- begin;
-- revoke insert (show_cpbl), update (show_cpbl) on public.profiles from authenticated;
-- alter table public.profiles       drop column if exists show_cpbl;
-- alter table public.camping_trips  drop column if exists visibility;
-- alter table public.calendar_events
--   drop column if exists cpbl_game_id,
--   drop column if exists visibility,
--   drop column if exists end_date,
--   drop column if exists start_date,
--   drop column if exists category_id;
-- drop table if exists public.event_categories;  -- policy 隨表一起刪除
-- commit;
