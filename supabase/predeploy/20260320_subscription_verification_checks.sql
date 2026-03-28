-- Subscription + verification DB checks
-- Run after all billing and verification migrations.
-- This raises exceptions for structural issues and returns diagnostics for data issues.

DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(item) INTO missing
  FROM (
    SELECT unnest(ARRAY[
      'subscriptions',
      'payments',
      'profiles',
      'advocates',
      'draft_requests',
      'draft_request_messages'
    ]) AS item
  ) required
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name = required.item
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required billing tables: %', array_to_string(missing, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'grace_ends_at'
  ) THEN
    RAISE EXCEPTION 'Missing column: public.subscriptions.grace_ends_at';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'effective_status'
  ) THEN
    RAISE EXCEPTION 'Missing column: public.subscriptions.effective_status';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'target_plan_type'
  ) THEN
    RAISE EXCEPTION 'Missing column: public.subscriptions.target_plan_type';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'downgrade_required'
  ) THEN
    RAISE EXCEPTION 'Missing column: public.subscriptions.downgrade_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'verification_source'
  ) THEN
    RAISE EXCEPTION 'Missing column: public.profiles.verification_source';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'badge_expires_at'
  ) THEN
    RAISE EXCEPTION 'Missing column: public.profiles.badge_expires_at';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'advocates'
      AND column_name = 'verification_source'
  ) THEN
    RAISE EXCEPTION 'Missing column: public.advocates.verification_source';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'advocates'
      AND column_name = 'badge_expires_at'
  ) THEN
    RAISE EXCEPTION 'Missing column: public.advocates.badge_expires_at';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'subscriptions'
      AND c.contype = 'f'
      AND c.conname = 'subscriptions_user_id_fkey'
  ) THEN
    RAISE EXCEPTION 'Missing FK: public.subscriptions.user_id -> auth.users';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public'
      AND r.relname = 'payments'
      AND c.contype = 'f'
      AND c.conname = 'payments_user_id_fkey'
  ) THEN
    RAISE EXCEPTION 'Missing FK: public.payments.user_id -> auth.users';
  END IF;

  RAISE NOTICE 'Subscription + verification structure checks passed.';
END $$;

-- Diagnostic 1: advocates whose profile verification state and advocate verification state differ.
SELECT
  p.id AS user_id,
  p.email,
  p.is_verified AS profile_verified,
  p.verification_source AS profile_source,
  p.badge_expires_at AS profile_badge_expires_at,
  a.is_verified AS advocate_verified,
  a.verification_source AS advocate_source,
  a.badge_expires_at AS advocate_badge_expires_at
FROM public.profiles p
JOIN public.advocates a ON a.user_id = p.id
WHERE p.role = 'advocate'
  AND (
    COALESCE(p.is_verified, false) <> COALESCE(a.is_verified, false)
    OR COALESCE(p.verification_source, '') <> COALESCE(a.verification_source, '')
    OR COALESCE(p.badge_expires_at::text, '') <> COALESCE(a.badge_expires_at::text, '')
  )
ORDER BY p.email;

-- Diagnostic 2: advocates with more than one active/pending subscription row.
SELECT
  s.user_id,
  p.email,
  COUNT(*) AS active_subscription_rows
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status IN ('active', 'pending')
GROUP BY s.user_id, p.email
HAVING COUNT(*) > 1
ORDER BY active_subscription_rows DESC, p.email;

-- Diagnostic 3: Pro-verified advocates whose latest valid subscription is not Pro.
WITH latest_sub AS (
  SELECT DISTINCT ON (s.user_id)
    s.user_id,
    s.plan_type,
    s.status,
    s.end_date,
    COALESCE(s.grace_ends_at, s.end_date + interval '3 days') AS grace_ends_at
  FROM public.subscriptions s
  WHERE s.status IN ('active', 'pending')
  ORDER BY s.user_id, s.end_date DESC NULLS LAST
)
SELECT
  p.id AS user_id,
  p.email,
  p.verification_source,
  ls.plan_type,
  ls.status,
  ls.end_date,
  ls.grace_ends_at
FROM public.profiles p
LEFT JOIN latest_sub ls ON ls.user_id = p.id
WHERE p.role = 'advocate'
  AND p.verification_source = 'pro'
  AND (
    ls.user_id IS NULL
    OR ls.plan_type <> 'pro'
    OR ls.grace_ends_at < now()
  )
ORDER BY p.email;

-- Diagnostic 4: badge-verified advocates whose badge is expired or missing.
SELECT
  p.id AS user_id,
  p.email,
  p.is_verified,
  p.verification_source,
  p.badge_expires_at
FROM public.profiles p
WHERE p.role = 'advocate'
  AND p.verification_source = 'badge'
  AND (
    p.badge_expires_at IS NULL
    OR p.badge_expires_at < now()
  )
ORDER BY p.email;

-- Diagnostic 5: pending badge/service payments and pending subscription payments.
SELECT
  user_id,
  payment_type,
  payment_status,
  amount,
  currency,
  razorpay_order_id,
  created_at,
  metadata
FROM public.payments
WHERE payment_status = 'pending'
ORDER BY created_at DESC;
