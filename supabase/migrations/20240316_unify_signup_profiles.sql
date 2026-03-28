-- MIGRATION: Unify Signup and Profile Data
-- This migration updates the handle_new_user trigger to capture all legal/personal details
-- provided during signup and store them directly in the role-specific tables.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  v_role text;
  v_full_name text;
  v_phone text;
BEGIN
  -- 1. Extract basic metadata
  v_role := new.raw_user_meta_data->>'role';
  v_full_name := new.raw_user_meta_data->>'full_name';
  v_phone := new.raw_user_meta_data->>'phone';

  -- Default role if missing
  IF v_role IS NULL THEN
      v_role := 'client';
  END IF;

  -- 2. Insert into central profiles table (for registry/admin usage)
  INSERT INTO public.profiles (id, email, role, full_name, phone)
  VALUES (new.id, new.email, v_role, v_full_name, v_phone)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    updated_at = now();

  -- 3. Insert into role-specific tables with ALL metadata fields
  IF v_role = 'advocate' THEN
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
          (new.raw_user_meta_data->>'experience_years')::integer,
          ARRAY(SELECT jsonb_array_elements_text(COALESCE(new.raw_user_meta_data->'specialization', '[]'::jsonb))),
          new.raw_user_meta_data->>'bio'
      )
      ON CONFLICT (user_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          bar_council_number = EXCLUDED.bar_council_number,
          bar_council_state = EXCLUDED.bar_council_state,
          experience_years = EXCLUDED.experience_years,
          specialization = EXCLUDED.specialization,
          bio = EXCLUDED.bio,
          updated_at = now();

  ELSIF v_role = 'client' THEN
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
          pincode = EXCLUDED.pincode,
          updated_at = now();
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
