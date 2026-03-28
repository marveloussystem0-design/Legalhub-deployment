-- COMPREHENSIVE FIX for Admin User List
-- This ensures admins can view all users while maintaining security

-- Step 1: Drop all admin-related policies to start fresh
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

-- Step 2: Ensure the basic "view own data" policy exists
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Step 3: Create WORKING admin policy
-- This checks the public.users table for the admin's OWN role first
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (
        -- Allow if viewing own record
        auth.uid() = id
        OR
        -- Allow if current user is an admin (check their own record)
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Step 4: Allow admins to delete users
CREATE POLICY "Admins can delete users" ON public.users
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Step 5: Update admin policies for advocates table
DROP POLICY IF EXISTS "Admins can view all advocates" ON public.advocates;
CREATE POLICY "Admins can view all advocates" ON public.advocates
    FOR SELECT USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Step 6: Update admin policies for clients table  
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
CREATE POLICY "Admins can view all clients" ON public.clients
    FOR SELECT USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );
