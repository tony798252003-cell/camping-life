-- Fix missing columns in camping_trips
alter table camping_trips add column if not exists altitude numeric;
alter table camping_trips add column if not exists night_rush boolean default false;
alter table camping_trips add column if not exists price numeric default 0;
alter table camping_trips add column if not exists cost numeric default 0;

-- Ensure foreign keys are indexed or at least exist (trip_photos)
-- The user likely ran the previous script, but just in case:
create table if not exists trip_photos (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users not null,
  trip_id bigint references camping_trips on delete cascade not null,
  url text not null,
  public_id text,
  caption text,
  width integer,
  height integer,
  created_at timestamptz default now()
);

-- Force schema cache reload (Supabase specific trick: notify pgrst)
NOTIFY pgrst, 'reload config';
