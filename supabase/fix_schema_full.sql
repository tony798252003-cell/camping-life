-- Comprehensive Schema Fix for Camping Trips
-- Add all potentially missing columns based on frontend usage

-- Text Fields
alter table camping_trips add column if not exists zone text;
alter table camping_trips add column if not exists companions text;
alter table camping_trips add column if not exists notes text;
alter table camping_trips add column if not exists entertainment text;
alter table camping_trips add column if not exists owner_friendliness text;
alter table camping_trips add column if not exists tent_type text;

-- Boolean Fields (Defaults to false)
alter table camping_trips add column if not exists is_windy boolean default false;
alter table camping_trips add column if not exists is_rainy boolean default false;
alter table camping_trips add column if not exists is_wet_tent boolean default false;
alter table camping_trips add column if not exists has_tarp boolean default false;
alter table camping_trips add column if not exists night_rush boolean default false;

-- ID Fields (Foreign Keys)
alter table camping_trips add column if not exists tent_id bigint;
alter table camping_trips add column if not exists tarp_id bigint;

-- Numeric Fields
alter table camping_trips add column if not exists cost numeric default 0;
alter table camping_trips add column if not exists price numeric default 0;
alter table camping_trips add column if not exists altitude numeric;
alter table camping_trips add column if not exists scenery numeric;
alter table camping_trips add column if not exists cleanliness numeric;
alter table camping_trips add column if not exists road_condition numeric;

-- Ensure trip_photos table exists (just in case)
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

-- Force Schema Cache Reload
NOTIFY pgrst, 'reload config';
