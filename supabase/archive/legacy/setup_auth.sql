-- 1. Add user_id column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'camping_trips' AND column_name = 'user_id') THEN
        ALTER TABLE camping_trips ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'camping_gear' AND column_name = 'user_id') THEN
        ALTER TABLE camping_gear ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE camping_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE camping_gear ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies for Camping Trips
-- Policy: Users can only see their own trips
DROP POLICY IF EXISTS "Users can view own trips" ON camping_trips;
CREATE POLICY "Users can view own trips" ON camping_trips
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own trips
DROP POLICY IF EXISTS "Users can insert own trips" ON camping_trips;
CREATE POLICY "Users can insert own trips" ON camping_trips
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own trips
DROP POLICY IF EXISTS "Users can update own trips" ON camping_trips;
CREATE POLICY "Users can update own trips" ON camping_trips
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own trips
DROP POLICY IF EXISTS "Users can delete own trips" ON camping_trips;
CREATE POLICY "Users can delete own trips" ON camping_trips
    FOR DELETE USING (auth.uid() = user_id);


-- 4. Create Policies for Camping Gear
-- Policy: Users can view own gear
DROP POLICY IF EXISTS "Users can view own gear" ON camping_gear;
CREATE POLICY "Users can view own gear" ON camping_gear
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert own gear
DROP POLICY IF EXISTS "Users can insert own gear" ON camping_gear;
CREATE POLICY "Users can insert own gear" ON camping_gear
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update own gear
DROP POLICY IF EXISTS "Users can update own gear" ON camping_gear;
CREATE POLICY "Users can update own gear" ON camping_gear
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete own gear
DROP POLICY IF EXISTS "Users can delete own gear" ON camping_gear;
CREATE POLICY "Users can delete own gear" ON camping_gear
    FOR DELETE USING (auth.uid() = user_id);
