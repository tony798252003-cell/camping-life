-- ULTIMATE SCHEMA FIX
-- This script adds ALL columns used in the frontend application to camping_trips.
-- Run this once to fix all "Could not find column" errors.

-- 1. Location & Coordinates
alter table camping_trips add column if not exists latitude double precision;
alter table camping_trips add column if not exists longitude double precision;
alter table camping_trips add column if not exists altitude numeric;
alter table camping_trips add column if not exists start_latitude double precision;
alter table camping_trips add column if not exists start_longitude double precision;
alter table camping_trips add column if not exists location text;
alter table camping_trips add column if not exists campsite_name text;

-- 2. Trip Details & Metadata
alter table camping_trips add column if not exists trip_date date;
alter table camping_trips add column if not exists duration_days integer default 1;
alter table camping_trips add column if not exists status text default 'planning';
alter table camping_trips add column if not exists zone text;
alter table camping_trips add column if not exists companions text;
alter table camping_trips add column if not exists notes text;
alter table camping_trips add column if not exists entertainment text;
alter table camping_trips add column if not exists owner_friendliness text;

-- 3. Boolean Flags / Defaults
alter table camping_trips add column if not exists night_rush boolean default false;
alter table camping_trips add column if not exists is_windy boolean default false;
alter table camping_trips add column if not exists is_rainy boolean default false;
alter table camping_trips add column if not exists is_wet_tent boolean default false;
alter table camping_trips add column if not exists has_tarp boolean default false;

-- 4. Financials
alter table camping_trips add column if not exists price numeric default 0;
alter table camping_trips add column if not exists cost numeric default 0;

-- 5. Gear Links
alter table camping_trips add column if not exists tent_id bigint;
alter table camping_trips add column if not exists tarp_id bigint;
alter table camping_trips add column if not exists tent_type text;

-- 6. Ratings
alter table camping_trips add column if not exists scenery numeric;
alter table camping_trips add column if not exists cleanliness numeric;
alter table camping_trips add column if not exists road_condition numeric;
alter table camping_trips add column if not exists rating numeric;

-- 7. Foreign Keys (if not exists)
-- This part is tricky in standard SQL 'if exists', so we use a safe block
do $$
begin
  -- Tent FK
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'camping_trips_tent_id_fkey') then
    alter table camping_trips add constraint camping_trips_tent_id_fkey foreign key (tent_id) references camping_gear(id) on delete set null;
  end if;
  -- Tarp FK
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'camping_trips_tarp_id_fkey') then
    alter table camping_trips add constraint camping_trips_tarp_id_fkey foreign key (tarp_id) references camping_gear(id) on delete set null;
  end if;
end $$;

-- 8. Force Cache Reload
NOTIFY pgrst, 'reload config';
