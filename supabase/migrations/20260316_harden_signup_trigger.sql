-- Harden auth signup trigger so auxiliary profile-table mismatches do not
-- break user creation with "Database error saving new user".

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
BEGIN
  v_requested_role := new.raw_user_meta_data->>'role';
  v_full_name := new.raw_user_meta_data->>'full_name';
  v_phone := new.raw_user_meta_data->>'phone';

  IF v_requested_role IN ('advocate', 'clerk', 'client') THEN
    v_final_role := v_requested_role;
  ELSE
    v_final_role := 'client';
  END IF;

  INSERT INTO public.profiles (id, email, role, full_name, phone)
  VALUES (new.id, new.email, v_final_role, v_full_name, v_phone)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    updated_at = now();

  IF v_final_role = 'advocate' THEN
    BEGIN
      INSERT INTO public.advocates (
        user_id,
        full_name,
        bar_council_number,
        bar_council_state,
        experience_years,
        specialization,
        bio
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
        new.raw_user_meta_data->>'bio'
      )
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        bar_council_number = EXCLUDED.bar_council_number,
        bar_council_state = EXCLUDED.bar_council_state,
        experience_years = EXCLUDED.experience_years,
        specialization = EXCLUDED.specialization,
        bio = EXCLUDED.bio;
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
