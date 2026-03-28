-- Fix admin permissions on profiles table
-- Only grant UPDATE and DELETE (not FOR ALL which causes SELECT recursion)
-- SELECT is already covered by the existing "Public profiles are viewable by everyone" policy

-- Drop the broken recursive policy
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Admins can update ANY profile (e.g. verify users)
-- Uses a SECURITY DEFINER function approach to avoid recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Now apply policies using the safe is_admin() function
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
CREATE POLICY "Admins can delete any profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin());
