-- 20261027000000_family_list_item_important.sql
-- 家庭待辦項目可標「重要」（星號）：未完成項目重要的排在最前面。
-- 使用方式：先跑 `npx tsx scripts/backup/backup-all.ts`（exit 0），再整份貼進 Supabase SQL Editor 執行
--           （begin/commit 包住）。只新增一個有預設值的欄位、不動既有資料。需使用者同意後才能套用正式庫。
-- 前提：20261023000000_family_lists.sql 已套用。
-- 權限：該表的 RLS 與 grant 都是整張表層級（select/insert/update/delete），新欄位自動涵蓋，不需另外 grant。
-- 套用後：再跑 `npm run db:types`（src/types/supabase.ts 目前是手動補入 important）。

begin;

alter table public.family_list_items
  add column important boolean not null default false;

commit;

-- ---------------------------------------------------------------------------
-- 回滾（會丟掉所有「重要」標記）：
-- ---------------------------------------------------------------------------
-- begin;
-- alter table public.family_list_items drop column important;
-- commit;
