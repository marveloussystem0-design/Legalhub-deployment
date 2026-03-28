-- PHASE 1: User Consolidation Migration
-- This script creates a unified 'profiles' table and migrates data
-- It DOES NOT drop old tables yet to ensure safety

-- 1. Create the new unified profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name text,
    email text,
    role text CHECK (role IN ('advocate', 'client', 'admin', 'clerk')),
    avatar_url text,
    is_verified boolean DEFAULT false,
    phone text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Migrate data from 'users' table
INSERT INTO public.profiles (id, email, role, is_verified, phone, created_at)
SELECT id, email, role, is_verified, phone, created_at
FROM public.users
ON CONFLICT (id) DO NOTHING;

-- 3. Merge data from 'user_profiles' (updates full_name if exists)
UPDATE public.profiles p
SET full_name = up.full_name,
    email = COALESCE(p.email, up.email),
    phone = COALESCE(p.phone, up.phone)
FROM public.user_profiles up
WHERE p.id = up.id;

-- 4. Ensure auth.users data is synced (last resort for missing emails)
-- Requires permissions on auth schema, might fail if run by normal user
-- skipping direct auth access for safety, handled by trigger usually

-- 5. Fix Foreign Keys (Safe Updates)
-- Add foreign key to 'cases' created_by if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cases_created_by_profiles_fkey') THEN
        ALTER TABLE public.cases 
        ADD CONSTRAINT cases_created_by_profiles_fkey 
        FOREIGN KEY (created_by) REFERENCES public.profiles(id);
    END IF;
END $$;

-- 6. Create Trigger to keep profiles in sync with auth.users (Future proofing)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (new.id, new.email, 'client', new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition (commented out to avoid conflicts if one exists, user should check triggers)
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
