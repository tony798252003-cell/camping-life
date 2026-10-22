-- verify-family-member.sql
-- 手動驗證 20261025000000_family_member_onboarding.sql：第二位家人（沒有 profiles 列的全新使用者）的完整流程。
-- 前提：20261017 ~ 20261025 的 migration 已套用到「要驗證的資料庫」（用測試庫；正式庫不要跑）。
-- 執行：  psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/rls/verify-family-member.sql
-- 安全性：整份在 BEGIN … ROLLBACK 內，所有 [QA] 資料最後一律 rollback。⚠ 請勿把最後的 ROLLBACK 改成 COMMIT。
-- 判讀：每項通過印 NOTICE「PASS: …」；失敗 raise exception。
-- 角色：A = 建立資料的家長（家庭 F1）；W = 全新使用者（沒有 profiles 列）；X = 另一家庭的人。

begin;

-- 輔助函式（建在 pg_temp，rollback 後消失）
create function pg_temp.pass(label text) returns void language plpgsql as $$
begin raise notice 'PASS: %', label; end $$;

-- 以 uid 的身分執行 stmt，回傳受影響列數；結束後切回原角色。錯誤會往外丟。
create function pg_temp.dml(uid uuid, stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  execute stmt;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
end $$;

-- 以 uid 的身分數「from_where」（例如 'public.calendar_events where id = ...'）有幾列
create function pg_temp.cnt(uid uuid, from_where text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  execute 'select count(*) from ' || from_where into n;
  execute 'reset role';
  return n;
end $$;

create function pg_temp.expect_cnt(uid uuid, from_where text, want bigint, label text) returns void language plpgsql as $$
declare got bigint := pg_temp.cnt(uid, from_where);
begin
  if got <> want then raise exception 'FAIL: % (expected %, got %)', label, want, got; end if;
  perform pg_temp.pass(label);
end $$;

-- 預期 stmt 受影響 want 列
create function pg_temp.expect_rows(uid uuid, stmt text, want bigint, label text) returns void language plpgsql as $$
declare got bigint := pg_temp.dml(uid, stmt);
begin
  if got <> want then raise exception 'FAIL: % (expected % rows, got %)', label, want, got; end if;
  perform pg_temp.pass(label);
end $$;

-- 預期 stmt 失敗：丟錯，或（RLS 靜默擋下）0 列
create function pg_temp.expect_blocked(uid uuid, stmt text, label text) returns void language plpgsql as $$
declare n bigint;
begin
  begin
    n := pg_temp.dml(uid, stmt);
  exception when others then
    execute 'reset role';
    perform pg_temp.pass(label || ' (error: ' || sqlerrm || ')');
    return;
  end;
  if n = 0 then perform pg_temp.pass(label || ' (0 rows)'); return; end if;
  raise exception 'FAIL: % (statement succeeded on % rows)', label, n;
end $$;

-- ---------------------------------------------------------------------------
-- 測試資料（postgres 身分）：W 只有 auth.users，故意不建 profiles
-- ---------------------------------------------------------------------------
create temp table qa_ids as select
  gen_random_uuid() as a, gen_random_uuid() as w, gen_random_uuid() as x,
  gen_random_uuid() as f1, gen_random_uuid() as f2,
  gen_random_uuid() as ev_priv, gen_random_uuid() as ev_shared,
  gen_random_uuid() as list1,
  'QAJOIN' || substr(gen_random_uuid()::text, 1, 6) as code;
grant select on qa_ids to public;

insert into auth.users (id, email) select a, '[QA]a-' || a || '@example.invalid' from qa_ids;
insert into auth.users (id, email) select w, '[QA]w-' || w || '@example.invalid' from qa_ids;
insert into auth.users (id, email) select x, '[QA]x-' || x || '@example.invalid' from qa_ids;
insert into public.families (id, name, invite_code, created_by) select f1, '[QA] F1', code, a from qa_ids;
insert into public.families (id, name, invite_code, created_by) select f2, '[QA] F2', 'QAOTHER' || substr(f2::text, 1, 6), x from qa_ids;
insert into public.profiles (id, family_id) select a, f1 from qa_ids on conflict (id) do update set family_id = excluded.family_id;
insert into public.profiles (id, family_id) select x, f2 from qa_ids on conflict (id) do update set family_id = excluded.family_id;

-- A 的資料：行程、帳篷、照片、事件（shared / private）、清單
insert into public.camping_trips (trip_date, user_id, family_id) select current_date, a, f1 from qa_ids;
insert into public.camping_gear (user_id, name, type) select a, '[QA] tent', 'tent' from qa_ids;
insert into public.trip_photos (trip_id, user_id, url, public_id)
  select t.id, q.a, 'https://example.invalid/p.jpg', 'qa' from qa_ids q, public.camping_trips t where t.user_id = q.a;
insert into public.calendar_events (id, title, start_time, end_time, family_id, created_by, visibility)
  select ev_priv, '[QA] A private', now(), now() + interval '1 hour', f1, a, 'private' from qa_ids;
insert into public.calendar_events (id, title, start_time, end_time, family_id, created_by, visibility)
  select ev_shared, '[QA] A shared', now(), now() + interval '1 hour', f1, a, 'shared' from qa_ids;
insert into public.family_lists (id, family_id, title, created_by) select list1, f1, '[QA] 清單', a from qa_ids;

-- ---------------------------------------------------------------------------
-- 加入前：W 沒有 profiles、什麼都看不到
-- ---------------------------------------------------------------------------
select pg_temp.expect_cnt(w, 'public.profiles where id = ''' || w || '''', 0, 'W 一開始沒有 profiles 列') from qa_ids;
select pg_temp.expect_cnt(w, 'public.camping_trips', 0, '加入前 W 看不到任何行程') from qa_ids;
select pg_temp.expect_cnt(w, 'public.family_lists', 0, '加入前 W 看不到清單') from qa_ids;

-- 錯誤邀請碼：丟 P0002，且不會建出 profiles
do $$
declare uid uuid; ok boolean := false;
begin
  select q.w into uid from qa_ids q;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.join_family_by_code('NOPE-NOT-A-CODE');
  exception when sqlstate 'P0002' then ok := true;
  end;
  execute 'reset role';
  if not ok then raise exception 'FAIL: 錯誤邀請碼應丟 P0002'; end if;
  perform pg_temp.pass('錯誤邀請碼丟 P0002');
end $$;
select pg_temp.expect_cnt(w, 'public.profiles where id = ''' || w || '''', 0, '錯誤邀請碼不會建立 profiles') from qa_ids;

-- 全新使用者用邀請碼（小寫、前後空白也可）加入
do $$
declare uid uuid; c text; got uuid; fam uuid;
begin
  select q.w, q.code, q.f1 into uid, c, fam from qa_ids q;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  got := public.join_family_by_code('  ' || lower(c) || ' ');
  execute 'reset role';
  if got is distinct from fam then raise exception 'FAIL: join 回傳的 family_id 不對'; end if;
  perform pg_temp.pass('沒有 profiles 的全新使用者可用邀請碼加入（RPC 回傳正確 family_id）');
end $$;
select pg_temp.expect_cnt(w, 'public.profiles where id = ''' || w || ''' and family_id = ''' || f1 || '''', 1, 'join 後 W 有 profiles 且 family_id 正確') from qa_ids;

-- 已有 profiles 的人再加入：只改 family_id，其他欄位不動
update public.profiles p set location_name = '[QA] home' from qa_ids q where p.id = q.w;
do $$
declare uid uuid; c text; n text;
begin
  select q.w, q.code into uid, c from qa_ids q;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.join_family_by_code(c);
  execute 'reset role';
  select location_name into n from public.profiles where id = uid;
  if n is distinct from '[QA] home' then raise exception 'FAIL: 重複 join 不應覆蓋其他欄位'; end if;
  perform pg_temp.pass('重複 join 為 idempotent，不覆蓋 location_name');
end $$;

-- ---------------------------------------------------------------------------
-- 加入後：看得到家庭資料
-- ---------------------------------------------------------------------------
select pg_temp.expect_cnt(w, 'public.camping_trips where user_id = ''' || a || '''', 1, 'W 看得到 A 的行程') from qa_ids;
select pg_temp.expect_cnt(w, 'public.camping_gear where user_id = ''' || a || '''', 1, 'W 看得到 A 的裝備（帳篷選單）') from qa_ids;
select pg_temp.expect_cnt(w, 'public.trip_photos', 1, 'W 看得到 A 行程的照片') from qa_ids;
select pg_temp.expect_cnt(w, 'public.calendar_events where id = ''' || ev_shared || '''', 1, 'W 看得到 shared 事件') from qa_ids;
select pg_temp.expect_cnt(w, 'public.calendar_events where id = ''' || ev_priv || '''', 0, 'W 看不到 A 的 private 事件') from qa_ids;
select pg_temp.expect_cnt(w, 'public.family_lists where id = ''' || list1 || '''', 1, 'W 看得到家庭清單') from qa_ids;
select pg_temp.expect_cnt(x, 'public.camping_trips where user_id = ''' || a || '''', 0, '其他家庭的 X 看不到 A 的行程') from qa_ids;
select pg_temp.expect_cnt(x, 'public.camping_gear where user_id = ''' || a || '''', 0, '其他家庭的 X 看不到 A 的裝備') from qa_ids;

-- 寫入：W 能改家庭行程但不能刪；W 自己建立的行程帶 family_id 後 A 看得到
select pg_temp.expect_rows(w, 'update public.camping_trips set notes = ''[QA] by W'' where user_id = ''' || a || '''', 1, 'W 可以更新 A 的行程') from qa_ids;
select pg_temp.expect_blocked(w, 'delete from public.camping_trips where user_id = ''' || a || '''', 'W 不能刪 A 的行程') from qa_ids;
select pg_temp.expect_blocked(w, 'delete from public.trip_photos', 'W 不能刪 A 的照片') from qa_ids;
select pg_temp.expect_blocked(w, 'delete from public.camping_gear where user_id = ''' || a || '''', 'W 不能刪 A 的裝備') from qa_ids;
select pg_temp.expect_cnt(a, 'public.camping_trips where user_id = ''' || a || ''' and notes = ''[QA] by W''', 1, '更新後行程仍屬於 A（擁有者沒被改）') from qa_ids;
select pg_temp.expect_rows(w, 'insert into public.camping_trips (trip_date, user_id, family_id) values (current_date, ''' || w || ''', ''' || f1 || ''')', 1, 'W 可以建立自己的家庭行程') from qa_ids;
select pg_temp.expect_cnt(a, 'public.camping_trips where user_id = ''' || w || '''', 1, 'A 看得到 W 建立的行程') from qa_ids;
select pg_temp.expect_rows(w, 'insert into public.trip_photos (trip_id, user_id, url, public_id) select id, ''' || w || ''', ''https://example.invalid/w.jpg'', ''qaw'' from public.camping_trips where user_id = ''' || a || '''', 1, 'W 可以對家庭行程上傳照片') from qa_ids;
select pg_temp.expect_rows(w, 'delete from public.trip_photos where user_id = ''' || w || '''', 1, 'W 可以刪自己上傳的照片') from qa_ids;
select pg_temp.expect_rows(w, 'insert into public.family_list_items (list_id, text) values (''' || list1 || ''', ''[QA] item'')', 1, 'W 可以在家庭清單新增項目') from qa_ids;

select 'ALL CHECKS PASSED' as result;

-- 一律 rollback，不留下任何資料。請勿改成 COMMIT。
rollback;
