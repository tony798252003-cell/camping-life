-- Forcefully reload the schema cache
NOTIFY pgrst, 'reload config';

-- Ensure critical columns exist (just in case)
alter table camping_trips add column if not exists campsite_name text;
alter table camping_trips add column if not exists location text;
alter table camping_trips add column if not exists trip_date date;

-- Ensure Foreign Key for Trip Photos exists correctly for the join to work
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'trip_photos_trip_id_fkey'
  ) then
    alter table trip_photos 
    add constraint trip_photos_trip_id_fkey 
    foreign key (trip_id) 
    references camping_trips(id) 
    on delete cascade;
  end if;
end $$;

-- Verify RLS is on but allows access
alter table camping_trips enable row level security;
alter table trip_photos enable row level security;
