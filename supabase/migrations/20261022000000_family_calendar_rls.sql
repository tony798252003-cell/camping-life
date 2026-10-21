-- 20261022000000_family_calendar_rls.sql
-- F1 家庭共用行事曆（docs/superpowers/specs/2026-10-22-family-calendar-f1-design.md）：權限與加入家庭 RPC。
-- 問題：現有 "Users can view family events" 只看 family_id、不看 visibility，同家庭的人會看到對方的 private 事件；
--       家庭 RPC 在 20261020 全部被收回 EXECUTE，且 profiles.family_id 沒有欄位授權，前端目前無法加入家庭。
-- 使用方式：先跑 `npx tsx scripts/backup/backup-all.ts`（exit 0），再整份貼進 Supabase SQL Editor 執行
--           （begin/commit 包住，任何一行失敗就整份不生效）。不刪任何資料列。需使用者同意後才能套用正式庫。
-- 前提：20261020000000_enable_rls_core_tables.sql（family_member_ids、profiles 欄位授權）、
--       20261017000300_calendar_categories.sql（visibility、event_categories）已套用。
-- 套用後：再跑 `npm run db:types`（join_family_by_code 目前是手動補進 src/types/supabase.ts）。
-- 已知限制：calendar_events 的 UPDATE 授權是表層級，非建立者理論上可改 created_by；
--           WITH CHECK 無法比對舊值，真要擋需另加 trigger，F1 不做。

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

-- ---------------------------------------------------------------------------
-- 2. event_categories：SELECT 另允許同家庭成員的分類（對方的全家事件才能顯示分類名稱）
--    INSERT / UPDATE / DELETE 維持只有擁有者。
-- ---------------------------------------------------------------------------
create policy "Family can select member categories" on public.event_categories
  for select to authenticated using (
    owner_id in (select public.family_member_ids())
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
-- drop policy "Family can select member categories" on public.event_categories;
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
