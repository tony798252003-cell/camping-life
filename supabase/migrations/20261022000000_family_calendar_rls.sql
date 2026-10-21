-- 20261022000000_family_calendar_rls.sql
-- F1 家庭共用行事曆（docs/superpowers/specs/2026-10-22-family-calendar-f1-design.md）：權限與加入家庭 RPC。
-- 問題：現有 "Users can view family events" 只看 family_id、不看 visibility，同家庭的人會看到對方的 private 事件；
--       家庭 RPC 在 20261020 全部被收回 EXECUTE，且 profiles.family_id 沒有欄位授權，前端目前無法加入家庭。
-- 使用方式：先跑 `npx tsx scripts/backup/backup-all.ts`（exit 0），再整份貼進 Supabase SQL Editor 執行
--           （begin/commit 包住，任何一行失敗就整份不生效）。不刪任何資料列。需使用者同意後才能套用正式庫。
-- 前提：20261020000000_enable_rls_core_tables.sql（family_member_ids、profiles 欄位授權）、
--       20261017000300_calendar_categories.sql（visibility、event_categories）已套用。
-- 套用後：再跑 `npm run db:types`（join_family_by_code 目前是手動補進 src/types/supabase.ts）。
-- 安全備註：permissive policy 是 OR。若不鎖 created_by，非建立者可 PATCH {created_by: 自己, visibility: 'private'}：
--           舊列通過 shared 的 USING、新列通過建立者 policy 的 WITH CHECK，就能偷走並藏起別人的事件。
--           WITH CHECK 比對不到舊值，所以用 BEFORE UPDATE trigger 讓 created_by 不可變（見第 1e 段）。
--           auth.uid() 為 null（service_role / SQL Editor）時放行，資料修正仍可進行。

begin;

-- ---------------------------------------------------------------------------
-- 1. calendar_events
-- ---------------------------------------------------------------------------
-- 1a. SELECT：移除不看 visibility 的 family policy（會洩漏 private）
drop policy "Users can view family events" on public.calendar_events;

-- 1b. SELECT：自己的事件，或「全家」事件且同家庭。
--     保留 baseline 的 "Users can view their own events"（created_by = auth.uid()），這裡只補 shared 那一條。
create policy "Users can view shared family events" on public.calendar_events
  for select to authenticated using (
    visibility = 'shared'
    and family_id is not null
    and family_id = public.user_family_id()
  );

-- 1c. UPDATE / DELETE：建立者，或「全家」事件且同家庭（保留 baseball 的 own policy，補 shared 那條）
create policy "Family members can update shared events" on public.calendar_events
  for update to authenticated
  using (
    visibility = 'shared'
    and family_id is not null
    and family_id = public.user_family_id()
  )
  with check (
    family_id is not distinct from public.user_family_id()
    and visibility = 'shared'
  );

create policy "Family members can delete shared events" on public.calendar_events
  for delete to authenticated using (
    visibility = 'shared'
    and family_id is not null
    and family_id = public.user_family_id()
  );

-- 1d. 建立者自己的 UPDATE：改成 WITH CHECK「family_id 必須是自己目前的家庭（或兩者皆 null）」，
--     建立者可在 shared / private 間切換；非建立者只能走 1c，其 WITH CHECK 要求 visibility 仍是 shared
--     （= 不能把別人的事件改成 private 藏起來），且不能搬出家庭。
--     alter policy 只能改 using / with check，名稱沿用 baseline。
alter policy "Users can update their own events" on public.calendar_events
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and family_id is not distinct from public.user_family_id()
  );

-- 1e. created_by 不可變（一般使用者）：堵住上面 OR-bypass
create function public.calendar_events_lock_created_by() returns trigger
  language plpgsql
  set search_path = ''
  as $$
begin
  if auth.uid() is not null and new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger calendar_events_lock_created_by
  before update on public.calendar_events
  for each row execute function public.calendar_events_lock_created_by();

-- ---------------------------------------------------------------------------
-- 2. event_categories：同家庭成員只能看到「被同家庭的全家事件引用」的分類
--    （讓對方的全家事件能顯示分類名稱，但不洩漏只用在私人事件的分類名稱）。
--    owner_id 也必須是家人，避免有人把別的家庭的分類 id 填進全家事件來讀名稱。
--    INSERT / UPDATE / DELETE 維持只有擁有者。
-- ---------------------------------------------------------------------------
create policy "Family can select categories used by shared events" on public.event_categories
  for select to authenticated using (
    owner_id in (select public.family_member_ids())
    and exists (
      select 1 from public.calendar_events e
      where e.category_id = event_categories.id
        and e.visibility = 'shared'
        and e.family_id = public.user_family_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. 加入家庭 RPC
--    profiles.family_id 刻意不開欄位授權（防提權），加入只能走 SECURITY DEFINER，且只改呼叫者自己的 profile。
--    邀請碼比對不分大小寫；找不到就丟例外，前端轉成「邀請碼不正確」。
--    自己原本的行程與事件不會搬過去（不動任何其他資料列）。
-- ---------------------------------------------------------------------------
create function public.join_family_by_code(code_input text) returns uuid
  language plpgsql security definer
  set search_path = ''
  as $$
declare
  caller_id uuid := auth.uid();
  target_family_id uuid;
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;

  select f.id into target_family_id
  from public.families f
  where upper(f.invite_code) = upper(btrim(code_input))
  limit 1;

  if target_family_id is null then
    raise exception 'Invalid invite code.' using errcode = 'P0002';
  end if;

  update public.profiles set family_id = target_family_id where id = caller_id;
  if not found then
    raise exception 'Profile not found.';
  end if;

  return target_family_id;
end;
$$;

revoke execute on function public.join_family_by_code(text) from public, anon;
grant execute on function public.join_family_by_code(text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- rollback:
-- （使用者手動執行，不會自動跑）
-- ---------------------------------------------------------------------------
-- begin;
-- drop function if exists public.join_family_by_code(text);
-- drop trigger if exists calendar_events_lock_created_by on public.calendar_events;
-- drop function if exists public.calendar_events_lock_created_by();
-- drop policy "Family can select categories used by shared events" on public.event_categories;
-- -- alter policy 無法移除 WITH CHECK，用 drop + create 還原成 baseline 原樣：
-- drop policy "Users can update their own events" on public.calendar_events;
-- create policy "Users can update their own events" on public.calendar_events for update using (created_by = auth.uid());
-- drop policy "Family members can delete shared events" on public.calendar_events;
-- drop policy "Family members can update shared events" on public.calendar_events;
-- drop policy "Users can view shared family events" on public.calendar_events;
-- -- 還原 baseline 的 family policy（會再次洩漏 private，只在緊急回復時用）：
-- create policy "Users can view family events" on public.calendar_events for select
--   using (family_id in (select family_id from public.profiles where id = auth.uid()));
-- commit;
