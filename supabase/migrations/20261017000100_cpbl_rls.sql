-- cpbl_schedule：寫入只允許 service role（api/cpbl-sync.ts），前端 anon/authenticated 只能讀
drop policy if exists "Enable write access for authenticated users" on public.cpbl_schedule;
drop policy if exists "Enable read access for all users" on public.cpbl_schedule;
create policy "authenticated read" on public.cpbl_schedule for select to authenticated using (true);

-- TODO(Task 1.1): drop public.exec_sql if baseline confirms it exists and is executable by anon/authenticated

-- rollback:
-- drop policy if exists "authenticated read" on public.cpbl_schedule;
-- create policy "Enable read access for all users" on public.cpbl_schedule for select using (true);
-- create policy "Enable write access for authenticated users" on public.cpbl_schedule for all to authenticated using (true) with check (true);
