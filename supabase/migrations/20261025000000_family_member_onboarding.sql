-- 家人 onboarding：全新使用者（沒有 profiles 列）也能用邀請碼加入家庭
-- 問題：auth.users 沒有 trigger，profiles 列由前端建立；舊版 join_family_by_code 對沒有 profiles 列的人
--       `update ... if not found raise 'Profile not found.'`，第二位家人（老婆）第一次登入就加不進去。
-- 作法：CREATE OR REPLACE，找不到 profiles 就補一列（insert ... on conflict (id) do update set family_id）。
--       仍是 security definer / search_path ''，grant 不變（authenticated 可執行，anon 不行）。
--       只寫呼叫者自己的 profiles 列；不動其他資料列。
-- 不需要「建立家庭」路徑：邀請碼來自既有家庭，第二位成員只需要加入。
-- 需使用者同意後才能套用正式庫；套用後 src/types/supabase.ts 的簽名不變，不需重跑 db:types。

begin;

create or replace function public.join_family_by_code(code_input text) returns uuid
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

  -- 沒有 profiles 列就補一列；已有就只改 family_id，其他欄位保持原樣
  insert into public.profiles (id, family_id)
  values (caller_id, target_family_id)
  on conflict (id) do update set family_id = excluded.family_id;

  return target_family_id;
end;
$$;

revoke execute on function public.join_family_by_code(text) from public, anon;
grant execute on function public.join_family_by_code(text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- rollback:
-- （使用者手動執行，不會自動跑；還原成 20261022000000 的版本）
-- ---------------------------------------------------------------------------
-- begin;
-- create or replace function public.join_family_by_code(code_input text) returns uuid
--   language plpgsql security definer
--   set search_path = ''
--   as $$
-- declare
--   caller_id uuid := auth.uid();
--   target_family_id uuid;
-- begin
--   if caller_id is null then raise exception 'Not authenticated.'; end if;
--   select f.id into target_family_id from public.families f
--   where upper(f.invite_code) = upper(btrim(code_input)) limit 1;
--   if target_family_id is null then
--     raise exception 'Invalid invite code.' using errcode = 'P0002';
--   end if;
--   update public.profiles set family_id = target_family_id where id = caller_id;
--   if not found then raise exception 'Profile not found.'; end if;
--   return target_family_id;
-- end;
-- $$;
-- revoke execute on function public.join_family_by_code(text) from public, anon;
-- grant execute on function public.join_family_by_code(text) to authenticated;
-- commit;
