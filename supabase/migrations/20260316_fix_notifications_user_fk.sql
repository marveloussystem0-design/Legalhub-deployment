-- Align notifications.user_id with the unified profiles table.

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
      AND rel.relname = 'notifications'
      AND con.contype = 'f'
      AND attr.attname = 'user_id'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
END $$;
