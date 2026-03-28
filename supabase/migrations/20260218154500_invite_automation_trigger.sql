-- FUNCTION: Automatically link newly registered users to their invited cases
CREATE OR REPLACE FUNCTION public.handle_invite_on_signup()
RETURNS trigger AS $$
BEGIN
    -- Check if there are ANY pending invites for this phone number
    -- Use the new index for performance
    IF NEW.phone IS NOT NULL THEN
        -- Insert into case_participants for each matching invite
        INSERT INTO public.case_participants (case_id, user_id, role)
        SELECT case_id, NEW.id, role
        FROM public.case_invites
        WHERE phone = NEW.phone
        AND status = 'pending';

        -- Update the status of those invites
        UPDATE public.case_invites
        SET status = 'accepted',
            accepted_by = NEW.id
        WHERE phone = NEW.phone
        AND status = 'pending';
    END IF;

    -- Also check for email-based invites (legacy support)
    IF NEW.email IS NOT NULL THEN
        INSERT INTO public.case_participants (case_id, user_id, role)
        SELECT case_id, NEW.id, role
        FROM public.case_invites
        WHERE email = NEW.email
        AND status = 'pending'
        ON CONFLICT DO NOTHING; -- Avoid duplicates if phone also matched

        UPDATE public.case_invites
        SET status = 'accepted',
            accepted_by = NEW.id
        WHERE email = NEW.email
        AND status = 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER: Run after a new profile is created
DROP TRIGGER IF EXISTS on_profile_created_invite_check ON public.profiles;
CREATE TRIGGER on_profile_created_invite_check
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_invite_on_signup();
