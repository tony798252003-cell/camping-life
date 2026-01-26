-- 1. Create 'families' table
CREATE TABLE IF NOT EXISTS public.families (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    name text NOT NULL,
    invite_code text UNIQUE NOT NULL,
    created_by uuid REFERENCES auth.users(id)
);

-- 2. Add 'family_id' to 'profiles'
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id);

-- 3. Add 'family_id' to 'camping_trips'
ALTER TABLE public.camping_trips 
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id);

-- 4. Add 'family_id' to 'camping_gear'
ALTER TABLE public.camping_gear 
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id);

-- 5. Enable RLS on 'families'
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- 6. Helper Function to get current user's family_id
-- (Moved to public schema to avoid permission issues)
CREATE OR REPLACE FUNCTION public.user_family_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT family_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 7. RLS Policies for 'families'
-- Allow users to view their own family
CREATE POLICY "Users can view their own family" ON public.families
FOR SELECT USING (
    id = public.user_family_id() 
    OR 
    created_by = auth.uid() -- Allow creator to see it even if not linked yet
);

-- Allow users to create family
CREATE POLICY "Users can create family" ON public.families
FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Allow users to update their own family
CREATE POLICY "Users can update their own family" ON public.families
FOR UPDATE USING (id = public.user_family_id());

-- 8. Update RLS Policies for 'camping_trips'
CREATE POLICY "View family trips" ON public.camping_trips
FOR SELECT USING (
    family_id IS NOT NULL 
    AND 
    family_id = public.user_family_id()
);

CREATE POLICY "Update family trips" ON public.camping_trips
FOR UPDATE USING (
    family_id IS NOT NULL 
    AND 
    family_id = public.user_family_id()
);

CREATE POLICY "Delete family trips" ON public.camping_trips
FOR DELETE USING (
    family_id IS NOT NULL 
    AND 
    family_id = public.user_family_id()
);

-- 9. Update RLS Policies for 'camping_gear' similarly
CREATE POLICY "View family gear" ON public.camping_gear
FOR SELECT USING (
    family_id IS NOT NULL 
    AND 
    family_id = public.user_family_id()
);

CREATE POLICY "Update family gear" ON public.camping_gear
FOR UPDATE USING (
    family_id IS NOT NULL 
    AND 
    family_id = public.user_family_id()
);

CREATE POLICY "Delete family gear" ON public.camping_gear
FOR DELETE USING (
    family_id IS NOT NULL 
    AND 
    family_id = public.user_family_id()
);
