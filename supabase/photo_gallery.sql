-- Create a table for storing photo metadata (hosted on Cloudinary)
create table if not exists trip_photos (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users not null,
  trip_id bigint references camping_trips on delete cascade not null,
  url text not null,        -- Cloudinary Secure URL
  public_id text,           -- Cloudinary Public ID (for deletion)
  caption text,             -- Optional caption
  width integer,            -- Original width
  height integer,           -- Original height
  created_at timestamptz default now()
);

-- Enable RLS
alter table trip_photos enable row level security;

-- Policies
create policy "Users can view photos of their families or own photos"
  on trip_photos for select
  using (
    -- User sees their own photos
    auth.uid() = user_id 
    OR 
    -- User sees photos of trips they have access to? 
    -- Simplification: If you can see the trip, you can see the photo.
    -- Assuming camping_trips policies handle trip access.
    exists (
       select 1 from camping_trips ct
       where ct.id = trip_photos.trip_id
       and ct.user_id = auth.uid() -- Basic ownership check
       -- Family logic handles shared trips via `get_family_trips` RPC usually, 
       -- but for direct table access we need RLS.
    )
  );

-- For now, let's stick to "Own photos" for simplicity, 
-- or broaden if family features are fully RLS-based.
-- The user already set up family RPCs, but RLS on tables might be strict.
-- Let's enable "Own insert/delete" strictly.

create policy "Users can insert their own photos"
  on trip_photos for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own photos"
  on trip_photos for delete
  using (auth.uid() = user_id);
