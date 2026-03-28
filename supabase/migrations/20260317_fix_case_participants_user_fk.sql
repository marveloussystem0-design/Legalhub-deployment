-- Fix legacy foreign key drift on case_participants.user_id.
-- The shared-case model uses profiles/auth user IDs, so this FK must point to public.profiles.

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel
      ON rel.oid = con.conrelid
    JOIN pg_namespace nsp
      ON nsp.oid = rel.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord)
      ON true
    JOIN pg_attribute attr
      ON attr.attrelid = rel.oid
     AND attr.attnum = cols.attnum
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'case_participants'
      AND con.contype = 'f'
      AND attr.attname = 'user_id'
  LOOP
    EXECUTE format('ALTER TABLE public.case_participants DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  ALTER TABLE public.case_participants
    ADD CONSTRAINT case_participants_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
END $$;
