-- Store case customizations per user so shared cases can keep shared facts
-- without leaking one advocate's personal label to another.

CREATE TABLE IF NOT EXISTS public.case_user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_user_preferences_case_user_key UNIQUE (case_id, user_id)
);

ALTER TABLE public.case_user_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_user_preferences'
      AND policyname = 'case_user_preferences_select_own'
  ) THEN
    CREATE POLICY case_user_preferences_select_own
      ON public.case_user_preferences
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_user_preferences'
      AND policyname = 'case_user_preferences_insert_own'
  ) THEN
    CREATE POLICY case_user_preferences_insert_own
      ON public.case_user_preferences
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_user_preferences'
      AND policyname = 'case_user_preferences_update_own'
  ) THEN
    CREATE POLICY case_user_preferences_update_own
      ON public.case_user_preferences
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_user_preferences'
      AND policyname = 'case_user_preferences_delete_own'
  ) THEN
    CREATE POLICY case_user_preferences_delete_own
      ON public.case_user_preferences
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_case_user_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS case_user_preferences_set_updated_at ON public.case_user_preferences;

CREATE TRIGGER case_user_preferences_set_updated_at
  BEFORE UPDATE ON public.case_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_case_user_preferences_updated_at();

-- Preserve existing custom titles for the original owner, then clear the shared
-- column so future reads come only from per-user preferences.
INSERT INTO public.case_user_preferences (case_id, user_id, display_title)
SELECT id, created_by, display_title
FROM public.cases
WHERE created_by IS NOT NULL
  AND display_title IS NOT NULL
  AND btrim(display_title) <> ''
ON CONFLICT (case_id, user_id) DO UPDATE
SET
  display_title = EXCLUDED.display_title,
  updated_at = now();

UPDATE public.cases
SET display_title = NULL
WHERE display_title IS NOT NULL
  AND btrim(display_title) <> '';
