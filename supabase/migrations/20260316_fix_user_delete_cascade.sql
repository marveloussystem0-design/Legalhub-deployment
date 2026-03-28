-- FIX: Ensure all foreign keys referencing public.profiles have correct DELETE behavior.
-- Run this in Supabase SQL Editor.

DO $$ BEGIN

  -- 1. Fix cases.created_by -> profiles(id) with ON DELETE SET NULL
  --    This only works for identifier-backed cases; admin user deletion still
  --    removes owner-created manual cases in application code before profile deletion.
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cases_created_by_fkey' AND table_name = 'cases') THEN
    ALTER TABLE public.cases DROP CONSTRAINT cases_created_by_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cases_created_by_profiles_fkey' AND table_name = 'cases') THEN
    ALTER TABLE public.cases DROP CONSTRAINT cases_created_by_profiles_fkey;
  END IF;
  ALTER TABLE public.cases
    ADD CONSTRAINT cases_created_by_profiles_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

  -- 2. Fix advocates.user_id -> profiles(id) with ON DELETE CASCADE
  --    (delete advocate profile when user is deleted)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'advocates_user_id_fkey' AND table_name = 'advocates') THEN
    ALTER TABLE public.advocates DROP CONSTRAINT advocates_user_id_fkey;
  END IF;
  ALTER TABLE public.advocates
    ADD CONSTRAINT advocates_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- 3. Fix clients.user_id -> profiles(id) with ON DELETE CASCADE
  --    (delete client profile when user is deleted)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'clients_user_id_fkey' AND table_name = 'clients') THEN
    ALTER TABLE public.clients DROP CONSTRAINT clients_user_id_fkey;
  END IF;
  ALTER TABLE public.clients
    ADD CONSTRAINT clients_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

END $$;
