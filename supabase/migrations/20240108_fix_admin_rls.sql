-- Fix 1: Allow Admins to view ALL users in public.users
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
);

-- Fix 2: Allow Admins to View/Edit ALL Advocates
CREATE POLICY "Admins can view all advocates"
ON public.advocates
FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
);

CREATE POLICY "Admins can update all advocates"
ON public.advocates
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
);

-- Fix 3: Allow Admins to View/Edit ALL Clients
CREATE POLICY "Admins can view all clients"
ON public.clients
FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
);

CREATE POLICY "Admins can update all clients"
ON public.clients
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
);

-- Fix 4: Allow Admins to Delete Users (for the delete button)
-- Note: Deleting from public.users usually cascades or requires permissions
CREATE POLICY "Admins can delete users"
ON public.users
FOR DELETE
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
);
