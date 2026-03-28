-- SECURITY PATCH: Secure Role Assignment
-- Fixes "Hardcoded Client" issue and "Admin Spoofing" risk.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  v_requested_role text;
  v_final_role text;
BEGIN
  -- 1. Get the requested role from metadata (or default to client)
  v_requested_role := new.raw_user_meta_data->>'role';

  -- 2. SECURITY CHECK
  -- Only allow 'advocate' or 'client' or 'clerk'.
  -- NEVER allow 'admin' from the frontend.
  IF v_requested_role IN ('advocate', 'clerk', 'client') THEN
      v_final_role := v_requested_role;
  ELSE
      -- Default fallback for "admin" attempts or missing data
      v_final_role := 'client';
  END IF;

  -- 3. Insert into profiles with the SAFE role
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    new.id, 
    new.email, 
    v_final_role, 
    new.raw_user_meta_data->>'full_name'
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
