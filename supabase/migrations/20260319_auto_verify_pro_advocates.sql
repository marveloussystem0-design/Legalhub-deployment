-- Auto-verify advocates who register directly with Pro subscription.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_role text;
  v_final_role text;
  v_full_name text;
  v_phone text;
  v_subscription_plan text;
  v_subscription_amount numeric(10,2);
  v_subscription_currency text;
  v_is_auto_verified boolean;
BEGIN
  v_requested_role := new.raw_user_meta_data->>'role';
  v_full_name := new.raw_user_meta_data->>'full_name';
  v_phone := new.raw_user_meta_data->>'phone';
  v_subscription_plan := lower(coalesce(new.raw_user_meta_data->>'subscription_plan', 'basic'));
  v_subscription_amount := COALESCE(NULLIF(new.raw_user_meta_data->>'subscription_amount', '')::numeric, 0);
  v_subscription_currency := coalesce(new.raw_user_meta_data->>'subscription_currency', 'INR');

  IF v_requested_role IN ('advocate', 'clerk', 'client') THEN
    v_final_role := v_requested_role;
  ELSE
    v_final_role := 'client';
  END IF;

  v_is_auto_verified := (v_final_role = 'advocate' AND v_subscription_plan = 'pro');

  INSERT INTO public.profiles (
    id,
    email,
    role,
    full_name,
    phone,
    is_verified,
    verification_source,
    badge_expires_at
  )
  VALUES (
    new.id,
    new.email,
    v_final_role,
    v_full_name,
    v_phone,
    v_is_auto_verified,
    CASE WHEN v_is_auto_verified THEN 'pro' ELSE NULL END,
    NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    is_verified = EXCLUDED.is_verified,
    verification_source = CASE
      WHEN EXCLUDED.is_verified THEN 'pro'
      ELSE public.profiles.verification_source
    END,
    badge_expires_at = CASE
      WHEN EXCLUDED.is_verified THEN NULL
      ELSE public.profiles.badge_expires_at
    END,
    updated_at = now();

  IF v_final_role = 'advocate' THEN
    BEGIN
      INSERT INTO public.subscriptions (
        user_id,
        plan_type,
        status,
        start_date,
        end_date,
        grace_ends_at,
        effective_status,
        billing_cycle,
        amount,
        currency,
        updated_at
      )
      SELECT
        new.id,
        CASE
          WHEN v_subscription_plan IN ('basic', 'medium', 'pro') THEN v_subscription_plan
          ELSE 'basic'
        END,
        'active',
        now(),
        now() + interval '30 days',
        now() + interval '33 days',
        'active',
        'monthly',
        v_subscription_amount,
        v_subscription_currency,
        now()
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.subscriptions s
        WHERE s.user_id = new.id
      );
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        RAISE WARNING 'Skipped subscription seed for user % due to schema mismatch: %', new.id, SQLERRM;
      WHEN others THEN
        RAISE WARNING 'Skipped subscription seed for user %: %', new.id, SQLERRM;
    END;

    BEGIN
      INSERT INTO public.advocates (
        user_id,
        full_name,
        bar_council_number,
        bar_council_state,
        experience_years,
        specialization,
        bio,
        is_verified,
        verification_source,
        badge_expires_at
      )
      VALUES (
        new.id,
        v_full_name,
        new.raw_user_meta_data->>'bar_council_number',
        new.raw_user_meta_data->>'bar_council_state',
        NULLIF(new.raw_user_meta_data->>'experience_years', '')::integer,
        ARRAY(
          SELECT jsonb_array_elements_text(
            COALESCE(new.raw_user_meta_data->'specialization', '[]'::jsonb)
          )
        ),
        new.raw_user_meta_data->>'bio',
        v_is_auto_verified,
        CASE WHEN v_is_auto_verified THEN 'pro' ELSE NULL END,
        NULL
      )
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        bar_council_number = EXCLUDED.bar_council_number,
        bar_council_state = EXCLUDED.bar_council_state,
        experience_years = EXCLUDED.experience_years,
        specialization = EXCLUDED.specialization,
        bio = EXCLUDED.bio,
        is_verified = EXCLUDED.is_verified,
        verification_source = CASE
          WHEN EXCLUDED.is_verified THEN 'pro'
          ELSE public.advocates.verification_source
        END,
        badge_expires_at = CASE
          WHEN EXCLUDED.is_verified THEN NULL
          ELSE public.advocates.badge_expires_at
        END;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        RAISE WARNING 'Skipped advocates sync for user % due to schema mismatch: %', new.id, SQLERRM;
      WHEN others THEN
        RAISE WARNING 'Skipped advocates sync for user %: %', new.id, SQLERRM;
    END;
  ELSIF v_final_role = 'client' THEN
    BEGIN
      INSERT INTO public.clients (
        user_id,
        full_name,
        address,
        city,
        state,
        pincode
      )
      VALUES (
        new.id,
        v_full_name,
        new.raw_user_meta_data->>'address',
        new.raw_user_meta_data->>'city',
        new.raw_user_meta_data->>'state',
        new.raw_user_meta_data->>'pincode'
      )
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        pincode = EXCLUDED.pincode;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        RAISE WARNING 'Skipped clients sync for user % due to schema mismatch: %', new.id, SQLERRM;
      WHEN others THEN
        RAISE WARNING 'Skipped clients sync for user %: %', new.id, SQLERRM;
    END;
  END IF;

  RETURN new;
END;
$$;

-- Backfill current Pro advocates that may still be unverified.
UPDATE public.profiles p
SET
  is_verified = true,
  verification_source = 'pro',
  badge_expires_at = NULL,
  updated_at = now()
WHERE p.role = 'advocate'
  AND p.is_verified = false
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
WHERE COALESCE(a.is_verified, false) = false
  AND EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = a.user_id
      AND s.plan_type = 'pro'
      AND s.status IN ('active', 'pending')
      AND COALESCE(s.grace_ends_at, s.end_date + interval '3 days') >= now()
  );

-- Backfill subscription rows for advocates who signed up with subscription metadata
-- before the trigger started seeding public.subscriptions.
INSERT INTO public.subscriptions (
  user_id,
  plan_type,
  status,
  start_date,
  end_date,
  grace_ends_at,
  effective_status,
  billing_cycle,
  amount,
  currency,
  updated_at
)
SELECT
  u.id,
  CASE
    WHEN lower(coalesce(u.raw_user_meta_data->>'subscription_plan', 'basic')) IN ('basic', 'medium', 'pro')
      THEN lower(coalesce(u.raw_user_meta_data->>'subscription_plan', 'basic'))
    ELSE 'basic'
  END,
  'active',
  coalesce(u.created_at, now()),
  coalesce(u.created_at, now()) + interval '30 days',
  coalesce(u.created_at, now()) + interval '33 days',
  'active',
  'monthly',
  COALESCE(NULLIF(u.raw_user_meta_data->>'subscription_amount', '')::numeric, 0),
  coalesce(u.raw_user_meta_data->>'subscription_currency', 'INR'),
  now()
FROM auth.users u
JOIN public.profiles p
  ON p.id = u.id
  AND p.role = 'advocate'
LEFT JOIN public.subscriptions s
  ON s.user_id = u.id
WHERE s.user_id IS NULL;
