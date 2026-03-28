-- Verification source and badge expiry support

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_source text,
  ADD COLUMN IF NOT EXISTS badge_expires_at timestamptz;

ALTER TABLE public.advocates
  ADD COLUMN IF NOT EXISTS verification_source text,
  ADD COLUMN IF NOT EXISTS badge_expires_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_verification_source_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_verification_source_check
  CHECK (
    verification_source IS NULL
    OR verification_source IN ('pro', 'badge', 'admin', 'manual')
  );

ALTER TABLE public.advocates
  DROP CONSTRAINT IF EXISTS advocates_verification_source_check;
ALTER TABLE public.advocates
  ADD CONSTRAINT advocates_verification_source_check
  CHECK (
    verification_source IS NULL
    OR verification_source IN ('pro', 'badge', 'admin', 'manual')
  );

-- Pro advocates remain verified while their Pro subscription is active or in grace.
UPDATE public.profiles p
SET
  is_verified = true,
  verification_source = 'pro',
  badge_expires_at = NULL,
  updated_at = now()
WHERE p.role = 'advocate'
  AND EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = p.id
      AND s.plan_type = 'pro'
      AND s.status IN ('active', 'pending')
      AND COALESCE(s.grace_ends_at, s.end_date + interval '3 days') >= now()
  );

UPDATE public.advocates a
SET
  is_verified = true,
  verification_source = 'pro',
  badge_expires_at = NULL
WHERE EXISTS (
  SELECT 1
  FROM public.subscriptions s
  WHERE s.user_id = a.user_id
    AND s.plan_type = 'pro'
    AND s.status IN ('active', 'pending')
    AND COALESCE(s.grace_ends_at, s.end_date + interval '3 days') >= now()
);

-- Keep existing manually verified advocates tagged rather than leaving source unknown.
UPDATE public.profiles
SET verification_source = 'admin'
WHERE is_verified = true
  AND verification_source IS NULL;

UPDATE public.advocates
SET verification_source = 'admin'
WHERE is_verified = true
  AND verification_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_verification_source
  ON public.profiles(verification_source);

CREATE INDEX IF NOT EXISTS idx_advocates_badge_expires_at
  ON public.advocates(badge_expires_at);
