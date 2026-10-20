-- Create calendar_events table
create table if not exists public.calendar_events (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_all_day boolean default true,
  event_type text default 'custom', -- 'custom', 'maintenance', 'todo'
  color text default '#3b82f6', -- blue-500
  family_id uuid references public.families(id) on delete cascade,
  created_by uuid references auth.users(id) on delete cascade default auth.uid()
);

-- RLS Policies
alter table public.calendar_events enable row level security;

-- Policy: Users can view events they created
create policy "Users can view their own events"
  on public.calendar_events
  for select
  using (created_by = auth.uid());

-- Policy: Users can view events belonging to their family
create policy "Users can view family events"
  on public.calendar_events
  for select
  using (
    family_id in (
      select family_id from public.profiles where id = auth.uid()
    )
  );

-- Policy: Users can insert events (own or family)
create policy "Users can insert events"
  on public.calendar_events
  for insert
  with check (
    created_by = auth.uid() and (
      family_id is null or
      family_id in (
        select family_id from public.profiles where id = auth.uid()
      )
    )
  );

-- Policy: Users can update their own events
create policy "Users can update their own events"
  on public.calendar_events
  for update
  using (created_by = auth.uid());

-- Policy: Users can delete their own events
create policy "Users can delete their own events"
  on public.calendar_events
  for delete
  using (created_by = auth.uid());
