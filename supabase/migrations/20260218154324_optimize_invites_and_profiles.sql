-- OPTIMIZATION: Add index to profiles for fast phone lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- ENHANCEMENT: Update case_invites to support phone and tokens
DO $$ 
BEGIN
    -- Add phone column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'case_invites' AND column_name = 'phone') THEN
        ALTER TABLE public.case_invites ADD COLUMN phone text;
    END IF;

    -- Make email nullable (previously it was mandatory)
    ALTER TABLE public.case_invites ALTER COLUMN email DROP NOT NULL;

    -- Add token column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'case_invites' AND column_name = 'token') THEN
        ALTER TABLE public.case_invites ADD COLUMN token uuid DEFAULT gen_random_uuid();
    END IF;

    -- Add status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'case_invites' AND column_name = 'status') THEN
        ALTER TABLE public.case_invites ADD COLUMN status text DEFAULT 'pending';
    END IF;
END $$;

-- Add unique constraint on token for security/lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_invites_token ON public.case_invites(token);
CREATE INDEX IF NOT EXISTS idx_case_invites_phone ON public.case_invites(phone);
