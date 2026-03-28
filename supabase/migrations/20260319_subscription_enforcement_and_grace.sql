-- Subscription enforcement support (grace + downgrade workflow)

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS grace_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS effective_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS target_plan_type text,
  ADD COLUMN IF NOT EXISTS downgrade_required boolean NOT NULL DEFAULT false;

UPDATE public.subscriptions
SET grace_ends_at = COALESCE(grace_ends_at, end_date + interval '3 days')
WHERE end_date IS NOT NULL;

UPDATE public.subscriptions
SET effective_status = CASE
  WHEN status IN ('active', 'pending') AND end_date >= now() THEN 'active'
  WHEN status IN ('active', 'pending') AND end_date < now() AND COALESCE(grace_ends_at, end_date + interval '3 days') >= now() THEN 'grace'
  ELSE 'expired'
END;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_effective_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_effective_status_check
  CHECK (effective_status IN ('active', 'grace', 'expired'));

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_target_plan_type_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_target_plan_type_check
  CHECK (target_plan_type IS NULL OR target_plan_type IN ('basic', 'medium', 'pro'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_end_date
  ON public.subscriptions(user_id, end_date DESC);
