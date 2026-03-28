-- Pre-deploy DB assertions for production safety.
-- Run this in Supabase SQL Editor against the target environment.
-- The script raises exceptions when required objects are missing.

DO $$
DECLARE
  missing text[];
BEGIN
  -- Required tables
  SELECT array_agg(tbl) INTO missing
  FROM (
    SELECT unnest(ARRAY[
      'cases',
      'case_participants',
      'case_hearings',
      'ecourts_cases',
      'case_ecourts_links',
      'notifications',
      'profiles',
      'case_invites'
    ]) AS tbl
  ) required
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name = required.tbl
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required tables: %', array_to_string(missing, ', ');
  END IF;

  -- Unique constraints/indexes used by upsert paths
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'cases'
      AND c.contype = 'u'
      AND c.conname = 'cases_case_number_key'
  ) THEN
    RAISE EXCEPTION 'Missing unique constraint: public.cases_case_number_key';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'cases'
      AND c.contype = 'u'
      AND c.conname = 'cases_cino_key'
  ) THEN
    RAISE EXCEPTION 'Missing unique constraint: public.cases_cino_key';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'ecourts_cases'
      AND c.contype = 'u'
      AND c.conname = 'ecourts_cases_cnr_number_key'
  ) THEN
    RAISE EXCEPTION 'Missing unique constraint: public.ecourts_cases_cnr_number_key';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'case_ecourts_links'
      AND c.contype = 'u'
      AND c.conname = 'case_ecourts_links_case_id_ecourts_case_id_key'
  ) THEN
    RAISE EXCEPTION 'Missing unique constraint: public.case_ecourts_links_case_id_ecourts_case_id_key';
  END IF;

  -- Foreign keys required by current app logic
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'case_participants'
      AND c.contype = 'f'
      AND c.conname = 'case_participants_user_id_profiles_fkey'
  ) THEN
    RAISE EXCEPTION 'Missing FK: public.case_participants_user_id_profiles_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'notifications'
      AND c.contype = 'f'
      AND c.conname = 'notifications_user_id_profiles_fkey'
  ) THEN
    RAISE EXCEPTION 'Missing FK: public.notifications_user_id_profiles_fkey';
  END IF;

  RAISE NOTICE 'Pre-deploy DB assertions passed.';
END $$;
