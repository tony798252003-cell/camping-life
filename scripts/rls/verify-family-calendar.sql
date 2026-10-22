-- verify-family-calendar.sql
-- 手動驗證 20261022000000_family_calendar_rls.sql 的權限（F1 家庭共用行事曆）。
-- 前提：該 migration 已套用到「要驗證的資料庫」（建議測試庫；正式庫套用前請先取得使用者同意）。
-- 執行：  psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/rls/verify-family-calendar.sql
--         （$DB_URL 用有權限建立 auth.users 的連線，例如 Supabase 的 postgres 連線字串）
-- 安全性：整份在 BEGIN … ROLLBACK 內，所有 [QA] 暫存資料（使用者、家庭、分類、事件）最後一律 rollback，不會留下任何資料。
--         ⚠ 請勿把最後的 ROLLBACK 改成 COMMIT。
-- 判讀：每項通過會印 NOTICE「PASS: …」；任何一項失敗會 raise exception（ON_ERROR_STOP 時 psql 立即停止，交易自動 rollback）。
-- 模擬方式：以 postgres 建資料，再用 set_config('role','authenticated') + request.jwt.claims 切換成 A / B / C。
--         A、B 同家庭 F1；C 在另一個家庭 F2。

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
-- 建立測試資料（以 postgres 身分）
-- ---------------------------------------------------------------------------
create temp table qa_ids as select
  gen_random_uuid() as a, gen_random_uuid() as b, gen_random_uuid() as c,
  gen_random_uuid() as f1, gen_random_uuid() as f2,
  gen_random_uuid() as cat_shared, gen_random_uuid() as cat_priv, gen_random_uuid() as cat_b,
  gen_random_uuid() as ev_priv, gen_random_uuid() as ev_shared;
grant select on qa_ids to public;

insert into auth.users (id, email) select a, '[QA]a-' || a || '@example.invalid' from qa_ids;
insert into auth.users (id, email) select b, '[QA]b-' || b || '@example.invalid' from qa_ids;
insert into auth.users (id, email) select c, '[QA]c-' || c || '@example.invalid' from qa_ids;

insert into public.families (id, name, invite_code, created_by) select f1, '[QA] F1', 'QA' || substr(f1::text, 1, 6), a from qa_ids;
insert into public.families (id, name, invite_code, created_by) select f2, '[QA] F2', 'QB' || substr(f2::text, 1, 6), c from qa_ids;

insert into public.profiles (id, family_id) select a, f1 from qa_ids
  on conflict (id) do update set family_id = excluded.family_id;
insert into public.profiles (id, family_id) select b, f1 from qa_ids
  on conflict (id) do update set family_id = excluded.family_id;
insert into public.profiles (id, family_id) select c, f2 from qa_ids
  on conflict (id) do update set family_id = excluded.family_id;

-- A 的分類：cat_shared 被全家事件使用，cat_priv 只被私人事件使用；B 自己也有一個
insert into public.event_categories (id, owner_id, name, color) select cat_shared, a, '[QA] A-shared', '#112233' from qa_ids;
insert into public.event_categories (id, owner_id, name, color) select cat_priv,   a, '[QA] A-private', '#112233' from qa_ids;
insert into public.event_categories (id, owner_id, name, color) select cat_b,      b, '[QA] B-own',     '#112233' from qa_ids;

insert into public.calendar_events (id, title, start_time, end_time, family_id, created_by, visibility, category_id)
  select ev_priv, '[QA] A private', now(), now() + interval '1 hour', f1, a, 'private', cat_priv from qa_ids;
insert into public.calendar_events (id, title, start_time, end_time, family_id, created_by, visibility, category_id)
  select ev_shared, '[QA] A shared', now(), now() + interval '1 hour', f1, a, 'shared', cat_shared from qa_ids;

-- ---------------------------------------------------------------------------
-- 事件可見性
-- ---------------------------------------------------------------------------
select pg_temp.expect_cnt(a, 'public.calendar_events where id = ''' || ev_priv || '''', 1, 'A 看得到自己的 private 事件') from qa_ids;
select pg_temp.expect_cnt(b, 'public.calendar_events where id = ''' || ev_priv || '''', 0, 'B 看不到 A 的 private 事件') from qa_ids;
select pg_temp.expect_cnt(c, 'public.calendar_events where id = ''' || ev_priv || '''', 0, '其他家庭的 C 看不到 A 的 private 事件') from qa_ids;
select pg_temp.expect_cnt(b, 'public.calendar_events where id = ''' || ev_shared || '''', 1, 'B 看得到 A 的 shared 事件') from qa_ids;
select pg_temp.expect_cnt(c, 'public.calendar_events where id = ''' || ev_shared || '''', 0, '其他家庭的 C 看不到 A 的 shared 事件') from qa_ids;

-- ---------------------------------------------------------------------------
-- 事件修改
-- ---------------------------------------------------------------------------
select pg_temp.expect_rows(b, 'update public.calendar_events set title = ''[QA] edited by B'' where id = ''' || ev_shared || '''', 1, 'B 可以改 A 的 shared 事件內容') from qa_ids;
select pg_temp.expect_blocked(b, 'update public.calendar_events set title = ''x'' where id = ''' || ev_priv || '''', 'B 不能改 A 的 private 事件') from qa_ids;
select pg_temp.expect_blocked(b, 'delete from public.calendar_events where id = ''' || ev_priv || '''', 'B 不能刪 A 的 private 事件') from qa_ids;
select pg_temp.expect_blocked(b, 'update public.calendar_events set visibility = ''private'' where id = ''' || ev_shared || '''', 'B 不能把 A 的 shared 事件改成 private') from qa_ids;
-- P0：OR-bypass（改 created_by 成自己再藏起來）
select pg_temp.expect_blocked(b, 'update public.calendar_events set created_by = ''' || b || ''', visibility = ''private'' where id = ''' || ev_shared || '''', 'B 不能改 created_by 並設成 private（偷走事件）') from qa_ids;
select pg_temp.expect_blocked(b, 'update public.calendar_events set created_by = ''' || b || ''' where id = ''' || ev_shared || '''', 'B 不能只改 created_by') from qa_ids;
select pg_temp.expect_blocked(b, 'update public.calendar_events set family_id = ''' || f2 || ''' where id = ''' || ev_shared || '''', 'B 不能把 shared 事件搬到別的家庭') from qa_ids;

-- 以上失敗嘗試之後，事件必須原封不動
do $$
declare r record;
begin
  select e.created_by = q.a as owner_ok, e.visibility, e.family_id = q.f1 as fam_ok into r
    from public.calendar_events e, qa_ids q where e.id = q.ev_shared;
  if not (r.owner_ok and r.visibility = 'shared' and r.fam_ok) then
    raise exception 'FAIL: shared 事件在攻擊嘗試後被改動 %', r;
  end if;
  perform pg_temp.pass('攻擊嘗試後 created_by / visibility / family_id 皆未改變');
end $$;

-- 建立者自己可以把自己的事件在 shared / private 間切換
select pg_temp.expect_rows(a, 'update public.calendar_events set visibility = ''private'' where id = ''' || ev_shared || '''', 1, 'A（建立者）可把自己的事件改成 private') from qa_ids;
select pg_temp.expect_cnt(b, 'public.calendar_events where id = ''' || ev_shared || '''', 0, '改成 private 後 B 看不到') from qa_ids;
select pg_temp.expect_rows(a, 'update public.calendar_events set visibility = ''shared'' where id = ''' || ev_shared || '''', 1, 'A 可改回 shared') from qa_ids;

-- service_role / SQL Editor（auth.uid() 為 null）仍可修正 created_by
do $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', '', true);
  update public.calendar_events e set created_by = q.a from qa_ids q where e.id = q.ev_shared;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: 無 auth.uid() 的連線應可修改 created_by'; end if;
  perform pg_temp.pass('無 auth.uid()（service_role / SQL Editor）可以修正 created_by');
end $$;

-- ---------------------------------------------------------------------------
-- 分類可見性：家人只看得到「被同家庭的全家事件引用」的分類
-- ---------------------------------------------------------------------------
select pg_temp.expect_cnt(a, 'public.event_categories where id in (''' || cat_shared || ''', ''' || cat_priv || ''')', 2, 'A 看得到自己的兩個分類') from qa_ids;
select pg_temp.expect_cnt(b, 'public.event_categories where id = ''' || cat_shared || '''', 1, 'B 看得到被全家事件使用的 A 分類') from qa_ids;
select pg_temp.expect_cnt(b, 'public.event_categories where id = ''' || cat_priv || '''', 0, 'B 看不到只用在私人事件的 A 分類') from qa_ids;
select pg_temp.expect_cnt(b, 'public.event_categories where id = ''' || cat_b || '''', 1, 'B 看得到自己的分類') from qa_ids;
select pg_temp.expect_cnt(c, 'public.event_categories where id in (''' || cat_shared || ''', ''' || cat_priv || ''')', 0, '其他家庭的 C 看不到 A 的任何分類') from qa_ids;
select pg_temp.expect_blocked(b, 'update public.event_categories set name = ''[QA] hacked'' where id = ''' || cat_shared || '''', 'B 不能改 A 的分類') from qa_ids;
select pg_temp.expect_blocked(b, 'delete from public.event_categories where id = ''' || cat_shared || '''', 'B 不能刪 A 的分類') from qa_ids;

-- A 把事件改成 private 後，該分類不再被全家事件引用 -> B 看不到
select pg_temp.dml(a, 'update public.calendar_events set visibility = ''private'' where id = ''' || ev_shared || '''') from qa_ids;
select pg_temp.expect_cnt(b, 'public.event_categories where id = ''' || cat_shared || '''', 0, '分類不再被全家事件引用後 B 看不到') from qa_ids;

select 'ALL CHECKS PASSED' as result;

-- 一律 rollback，不留下任何資料。請勿改成 COMMIT。
rollback;
