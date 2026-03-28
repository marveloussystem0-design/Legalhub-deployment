-- Function to claim invites when a new user signs up
CREATE OR REPLACE FUNCTION public.claim_invites_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Insert into case_participants for any matching pending invites
  INSERT INTO public.case_participants (case_id, user_id, role)
  SELECT case_id, NEW.id, 'client'
  FROM public.case_invites
  WHERE email = NEW.email
    AND status = 'pending';

  -- 2. Mark invites as accepted
  UPDATE public.case_invites
  SET status = 'accepted'
  WHERE email = NEW.email
    AND status = 'pending';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger logic
-- We need to attach this to auth.users. 
-- Note: In Supabase, you must be careful triggering off auth.users.
-- This SQL assumes we have permissions to create triggers on auth.users.

DROP TRIGGER IF EXISTS on_auth_user_created_claim_invites ON auth.users;

CREATE TRIGGER on_auth_user_created_claim_invites
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.claim_invites_on_signup();
