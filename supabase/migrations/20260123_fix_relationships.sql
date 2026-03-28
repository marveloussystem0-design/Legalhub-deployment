-- PHASE 1.5: Fix Relationships
-- Update Foreign Keys to point to the new 'profiles' table
-- This allows Supabase to detect the relationship for joins

-- 1. Updates Advocates FK
ALTER TABLE public.advocates 
DROP CONSTRAINT IF EXISTS advocates_user_id_fkey;

ALTER TABLE public.advocates
ADD CONSTRAINT advocates_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- 2. Update Clients FK
ALTER TABLE public.clients
DROP CONSTRAINT IF EXISTS clients_user_id_fkey;

ALTER TABLE public.clients
ADD CONSTRAINT clients_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- 3. Update Cases Created_By explicitly (if not done)
ALTER TABLE public.cases
DROP CONSTRAINT IF EXISTS cases_created_by_fkey;

ALTER TABLE public.cases
ADD CONSTRAINT cases_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(id);
