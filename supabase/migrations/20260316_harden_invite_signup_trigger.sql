-- Harden profile invite automation so it never aborts signup.

CREATE OR REPLACE FUNCTION public.handle_invite_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NEW.phone IS NOT NULL THEN
      INSERT INTO public.case_participants (case_id, user_id, role)
      SELECT case_id, NEW.id, role
      FROM public.case_invites
      WHERE phone = NEW.phone
        AND status = 'pending'
      ON CONFLICT DO NOTHING;

      UPDATE public.case_invites
      SET status = 'accepted',
          accepted_by = NEW.id
      WHERE phone = NEW.phone
        AND status = 'pending';
    END IF;

    IF NEW.email IS NOT NULL THEN
      INSERT INTO public.case_participants (case_id, user_id, role)
      SELECT case_id, NEW.id, role
      FROM public.case_invites
      WHERE email = NEW.email
        AND status = 'pending'
      ON CONFLICT DO NOTHING;

      UPDATE public.case_invites
      SET status = 'accepted',
          accepted_by = NEW.id
      WHERE email = NEW.email
        AND status = 'pending';
    END IF;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      RAISE WARNING 'Skipped invite-on-signup sync for user % due to schema mismatch: %', NEW.id, SQLERRM;
    WHEN others THEN
      RAISE WARNING 'Skipped invite-on-signup sync for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_invite_check ON public.profiles;

CREATE TRIGGER on_profile_created_invite_check
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invite_on_signup();
