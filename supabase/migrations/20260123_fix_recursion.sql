-- FIX RLS RECURSION (Infinite Loop)
-- The "Cases" policy checks "Participants". The "Participants" policy checks "Cases".
-- This loop crashes the query engine and hides data. We fix it with a Security Definer function.

-- 1. Helper Function: Is Case Owner? (Bypasses RLS loop)
CREATE OR REPLACE FUNCTION public.is_case_owner(c_id uuid)
RETURNS boolean AS $$
BEGIN
  -- This runs as System (Security Definer), so it doesn't trigger the 'cases' RLS policy again
  RETURN EXISTS (
    SELECT 1 FROM public.cases 
    WHERE id = c_id AND created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- 2. Unlock Tables for Update
ALTER TABLE public.cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_participants DISABLE ROW LEVEL SECURITY;

-- 3. Update 'case_participants' Policy to use the Safe Function
DROP POLICY IF EXISTS "View participants of my cases" ON public.case_participants;

CREATE POLICY "View participants of my cases" ON public.case_participants FOR SELECT
USING (
  user_id = auth.uid() OR -- I am the participant
  public.is_case_owner(case_id) OR -- I own the case (Safe Check)
  public.is_admin() -- I am admin
);

-- 4. Re-Enable RLS (Safe now)
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_participants ENABLE ROW LEVEL SECURITY;
