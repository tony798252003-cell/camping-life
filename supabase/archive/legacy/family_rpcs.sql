-- Secure RPCs for Family Management
-- Using SECURITY DEFINER to bypass RLS recursion issues

-- 1. Get Family Members
-- Returns profile info for all members of the caller's family
DROP FUNCTION IF EXISTS public.get_family_members();
CREATE OR REPLACE FUNCTION public.get_family_members()
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  avatar_url text,
  family_id uuid,
  is_head boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_family_id uuid;
  caller_id uuid;
BEGIN
  caller_id := auth.uid();
  
  -- Get caller's family_id
  SELECT p.family_id INTO caller_family_id
  FROM public.profiles p
  WHERE p.id = caller_id;

  IF caller_family_id IS NULL THEN
    RETURN; -- Return empty if no family
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    u.email::text,
    COALESCE((u.raw_user_meta_data->>'full_name')::text, (u.raw_user_meta_data->>'name')::text, u.email::text) as name,
    (u.raw_user_meta_data->>'avatar_url')::text as avatar_url,
    p.family_id,
    (f.created_by = p.id) as is_head
  FROM public.profiles p
  JOIN public.families f ON f.id = p.family_id
  JOIN auth.users u ON u.id = p.id
  WHERE p.family_id = caller_family_id;
END;
$$;

-- 2. Kick Family Member
-- Only the family head can call this
CREATE OR REPLACE FUNCTION public.kick_family_member(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  caller_family_id uuid;
  is_head boolean;
  target_family_id uuid;
BEGIN
  caller_id := auth.uid();
  
  -- Check if caller is head of their family
  SELECT 
    p.family_id,
    (f.created_by = caller_id)
  INTO caller_family_id, is_head
  FROM public.profiles p
  JOIN public.families f ON f.id = p.family_id
  WHERE p.id = caller_id;

  IF caller_family_id IS NULL OR is_head IS NOT TRUE THEN
    RAISE EXCEPTION 'Only the family head can kick members.';
  END IF;

  -- Verify target is in the same family
  SELECT family_id INTO target_family_id
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_family_id IS DISTINCT FROM caller_family_id THEN
    RAISE EXCEPTION 'Target user is not in your family.';
  END IF;

  -- Kick: Set family_id to NULL
  UPDATE public.profiles
  SET family_id = NULL
  WHERE id = target_user_id;
END;
$$;

-- 3. Leave Family
-- Any member can call this to leave their current family
CREATE OR REPLACE FUNCTION public.leave_family()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  UPDATE public.profiles
  SET family_id = NULL
  WHERE id = caller_id;
END;
$$;

-- 4. Get Family by Invite Code
-- Securely find a family by code without exposing all families (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_family_by_invite_code(code_input text)
RETURNS SETOF public.families
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.families
  WHERE invite_code = code_input
  LIMIT 1;
END;
$$;
