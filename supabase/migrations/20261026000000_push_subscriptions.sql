-- 手機推播提醒（docs/superpowers/specs/2026-10-22-push-reminders-design.md）：
--   push_subscriptions 存每支裝置的 Web Push 訂閱；每天由 api/cron/reminders 讀取並發送。
-- 使用方式：先跑 `npx tsx scripts/backup/backup-all.ts`（exit 0），再整份貼進 Supabase SQL Editor 執行
--           （begin/commit 包住，任何一行失敗就整份不生效）。只新增物件、不動任何既有資料。需使用者同意後才能套用正式庫。
-- 套用後：再跑 `npm run db:types`（src/types/supabase.ts 目前是手動補入此表）。
-- 設計取捨：
--   * 前端只能對「自己的」列 select／insert／delete（RLS）；不開放 update，換訂閱就刪掉重建。
--   * 排程用 service role（繞過 RLS）讀全部、清除 404／410 的失效訂閱、更新 last_success_at。
--   * endpoint unique：同一支裝置重複開啟只會有一列；insert 以 upsert(onConflict endpoint) 處理。
--   * user_id default auth.uid()，WITH CHECK 要求等於自己，無法替別人建訂閱。

begin;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Users can view own push subscriptions" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "Users can insert own push subscriptions" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users can delete own push subscriptions" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- 權限：與 20261020 一致——anon 完全沒有、authenticated 只給 select / insert / delete
revoke all on table public.push_subscriptions from anon;
revoke truncate, references, trigger, update on table public.push_subscriptions from authenticated;
grant select, insert, delete on table public.push_subscriptions to authenticated;

commit;

-- 回滾：
-- begin;
-- drop table public.push_subscriptions;
-- commit;
