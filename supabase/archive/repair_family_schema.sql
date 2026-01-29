-- Repair Family Schema and Relationships
-- This script ensures the necessary tables, columns, foreign keys, and policies exist for the Family feature.

-- 1. Ensure 'families' table exists
CREATE TABLE IF NOT EXISTS public.families (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    invite_code text UNIQUE NOT NULL,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- 2. Ensure 'profiles' has 'family_id'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE SET NULL;

-- 3. Enable RLS
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Families
-- Allow users to view the family they belong to
DROP POLICY IF EXISTS "Users can view their own family" ON public.families;
CREATE POLICY "Users can view their own family"
ON public.families FOR SELECT
USING (
  id IN (
    SELECT family_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Allow users to create families (INSERT)
DROP POLICY IF EXISTS "Users can create families" ON public.families;
CREATE POLICY "Users can create families"
ON public.families FOR INSERT
WITH CHECK (
  auth.uid() = created_by
);

-- Allow family members (or head) to update family? (Optional, usually head only)
DROP POLICY IF EXISTS "Family head can update family" ON public.families;
CREATE POLICY "Family head can update family"
ON public.families FOR UPDATE
USING (
  auth.uid() = created_by
);

-- 5. Helper: Re-create the foreign key constraint explicitly if Supabase isn't detecting it for auto-joins
-- Sometimes unnamed constraints cause issues in Supabase Studio or Auto-detection.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_family_id_fkey') THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_family_id_fkey
        FOREIGN KEY (family_id) REFERENCES public.families(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 6. Reload Schema
NOTIFY pgrst, 'reload config';
