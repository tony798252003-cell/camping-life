-- verify-push.sql
-- 手動驗證 20261026000000_push_subscriptions.sql：訂閱表 RLS 與 claim_push_subscription（換帳號認領同一個 endpoint）。
-- 前提：該 migration 已套用到「要驗證的資料庫」（用測試庫；正式庫不要跑）。
-- 執行：  psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/rls/verify-push.sql
-- 安全性：整份在 BEGIN … ROLLBACK 內，[QA] 資料最後一律 rollback。⚠ 請勿把最後的 ROLLBACK 改成 COMMIT。
-- 判讀：每項通過印 NOTICE「PASS: …」；失敗 raise exception。
-- 角色：A、B = 兩個使用者，共用同一支瀏覽器（同一個 endpoint）。

begin;

create function pg_temp.pass(label text) returns void language plpgsql as $$
begin raise notice 'PASS: %', label; end $$;

create temp table qa_ids as select gen_random_uuid() as a, gen_random_uuid() as b,
  'https://qa.invalid/push/' || gen_random_uuid() as ep;
grant select on qa_ids to public;

insert into auth.users (id, email) select a, '[QA]a-' || a || '@example.invalid' from qa_ids;
insert into auth.users (id, email) select b, '[QA]b-' || b || '@example.invalid' from qa_ids;

-- 以 uid 身分執行 stmt（authenticated）；null = 未登入的 authenticated；'anon' 另處理
create function pg_temp.as_user(uid uuid, stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', case when uid is null then '{"role":"authenticated"}' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
  perform set_config('role', 'authenticated', true);
  execute stmt;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
end $$;

create function pg_temp.cnt(uid uuid, q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  execute 'select count(*) from ' || q into n;
  execute 'reset role';
  return n;
end $$;

-- 1. A 訂閱
select pg_temp.as_user(a, format('select public.claim_push_subscription(%L, %L, %L)', ep, 'p-a', 'a-a')) from qa_ids;
do $$ declare r qa_ids; begin select * into r from qa_ids;
  if pg_temp.cnt(r.a, format('public.push_subscriptions where endpoint = %L and user_id = %L', r.ep, r.a)) <> 1 then raise exception 'FAIL: A 訂閱後應有自己的一列'; end if;
  perform pg_temp.pass('A claims endpoint -> row is A''s');
  if pg_temp.cnt(r.b, format('public.push_subscriptions where endpoint = %L', r.ep)) <> 0 then raise exception 'FAIL: B 不該看到 A 的列'; end if;
  perform pg_temp.pass('B cannot see A''s row');
end $$;

-- 2. 同一支瀏覽器換成 B 登入並認領：列改歸 B，金鑰更新，總數仍是 1
select pg_temp.as_user(b, format('select public.claim_push_subscription(%L, %L, %L)', ep, 'p-b', 'a-b')) from qa_ids;
do $$ declare r qa_ids; k text; begin select * into r from qa_ids;
  if (select count(*) from public.push_subscriptions where endpoint = r.ep) <> 1 then raise exception 'FAIL: endpoint 應只有一列'; end if;
  if (select user_id from public.push_subscriptions where endpoint = r.ep) <> r.b then raise exception 'FAIL: 列應改歸 B'; end if;
  select p256dh into k from public.push_subscriptions where endpoint = r.ep;
  if k <> 'p-b' then raise exception 'FAIL: 金鑰應更新為 B 的'; end if;
  perform pg_temp.pass('B claims same endpoint -> row now B''s (A no longer receives on this device)');
  if pg_temp.cnt(r.a, format('public.push_subscriptions where endpoint = %L', r.ep)) <> 0 then raise exception 'FAIL: A 不該看到 B 的列'; end if;
  perform pg_temp.pass('A cannot see B''s row');
  if pg_temp.cnt(r.b, format('public.push_subscriptions where endpoint = %L', r.ep)) <> 1 then raise exception 'FAIL: B 應看到自己的列'; end if;
  perform pg_temp.pass('B sees own row');
end $$;

-- 3. A 不能刪 B 的列（RLS delete 只限自己）
do $$ declare r qa_ids; begin select * into r from qa_ids;
  if pg_temp.as_user(r.a, format('delete from public.push_subscriptions where endpoint = %L', r.ep)) <> 0 then raise exception 'FAIL: A 不該能刪 B 的列'; end if;
  perform pg_temp.pass('A cannot delete B''s row');
end $$;

-- 4. 未登入（auth.uid() 為 null）呼叫被拒
do $$ declare r qa_ids; begin select * into r from qa_ids;
  begin
    perform pg_temp.as_user(null, format('select public.claim_push_subscription(%L, %L, %L)', r.ep, 'x', 'x'));
    raise exception 'FAIL: null uid 應被拒絕';
  exception when others then
    execute 'reset role';
    if sqlerrm like 'FAIL:%' then raise; end if;
    perform pg_temp.pass('null uid rejected (' || sqlerrm || ')');
  end;
end $$;

-- 5. anon 不能執行
do $$ declare r qa_ids; begin select * into r from qa_ids;
  begin
    perform set_config('role', 'anon', true);
    perform public.claim_push_subscription(r.ep, 'x', 'x');
    execute 'reset role';
    raise exception 'FAIL: anon 不應能呼叫';
  exception when insufficient_privilege then
    execute 'reset role';
    perform pg_temp.pass('anon cannot execute claim_push_subscription');
  end;
end $$;

rollback;
