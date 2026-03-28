-- =====================================================
-- FIX: Infinite Recursion in RLS Policies
-- =====================================================
-- Problem: cases table RLS checks case_participants,
--          case_participants RLS checks cases
--          This creates an infinite loop.
--
-- Solution: Use a security_definer function to check
--           participation without triggering RLS
-- =====================================================

-- Step 1: Create a security_definer function to check if user is a participant
CREATE OR REPLACE FUNCTION public.is_case_participant(case_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM case_participants
    WHERE case_id = case_id_param
    AND user_id = user_id_param
  );
END;
$$;

-- Step 2: Drop existing RLS policies that might be causing recursion
DROP POLICY IF EXISTS "Users can view their own cases" ON cases;
DROP POLICY IF EXISTS "Users can view participants of their cases" ON case_participants;
DROP POLICY IF EXISTS "Users can view case participants" ON case_participants;
DROP POLICY IF EXISTS "Advocates can view their cases" ON cases;

-- Step 3: Create new, non-recursive RLS policies

-- For cases table: Users can see cases they created OR cases they participate in
CREATE POLICY "Users can view cases they created or participate in"
ON cases
FOR SELECT
USING (
  created_by = auth.uid()
  OR
  public.is_case_participant(id, auth.uid())
);

-- For case_participants table: Simple policy - users can see their own participations
CREATE POLICY "Users can view their own participations"
ON case_participants
FOR SELECT
USING (user_id = auth.uid());

-- For case_hearings table: Users can see hearings for cases they have access to
DROP POLICY IF EXISTS "Users can view hearings for their cases" ON case_hearings;
CREATE POLICY "Users can view hearings for their cases"
ON case_hearings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = case_hearings.case_id
    AND (
      cases.created_by = auth.uid()
      OR public.is_case_participant(cases.id, auth.uid())
    )
  )
);

-- Step 4: Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.is_case_participant(uuid, uuid) TO authenticated;

-- =====================================================
-- Verification Query (Run this to test)
-- =====================================================
-- SELECT 
--   c.id,
--   c.title,
--   c.created_by,
--   public.is_case_participant(c.id, auth.uid()) as is_participant
-- FROM cases c
-- WHERE created_by = auth.uid()
-- LIMIT 5;
