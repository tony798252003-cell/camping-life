-- Create cpbl_schedule table
CREATE TABLE IF NOT EXISTS public.cpbl_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_sno INTEGER NOT NULL,
    game_date DATE NOT NULL,
    home_team_name TEXT NOT NULL,
    visiting_team_name TEXT NOT NULL,
    field_abbe TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_sno, game_date)
);

-- Set up Row Level Security
ALTER TABLE public.cpbl_schedule ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone
CREATE POLICY "Enable read access for all users" ON public.cpbl_schedule
    FOR SELECT USING (true);

-- Allow all operations for authenticated users (or restrict to admin later via policies)
CREATE POLICY "Enable write access for authenticated users" ON public.cpbl_schedule
    FOR ALL USING (auth.role() = 'authenticated');
