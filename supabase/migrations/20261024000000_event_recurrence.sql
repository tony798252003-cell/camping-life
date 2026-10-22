-- 20261024000000_event_recurrence.sql
-- F3 每年重複事件（docs/superpowers/specs/2026-10-22-family-f2-lists-anniversary-design.md）：
-- calendar_events 新增 recurrence 欄位，目前只支援 'yearly'（全天事件的生日、紀念日）。
-- 使用方式：先跑 `npx tsx scripts/backup/backup-all.ts`（exit 0），再整份貼進 Supabase SQL Editor 執行
--           （begin/commit 包住）。只新增 nullable 欄位，不動任何資料列。需使用者同意後才能套用正式庫。
-- 套用後：再跑 `npm run db:types`（recurrence 目前是手動補進 src/types/supabase.ts）。

begin;

alter table public.calendar_events
  add column recurrence text null check (recurrence in ('yearly'));

commit;

-- ---------------------------------------------------------------------------
-- 回滾（會刪掉重複設定，事件本身保留）：
-- ---------------------------------------------------------------------------
-- begin;
-- alter table public.calendar_events drop column recurrence;
-- commit;
