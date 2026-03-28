-- Trigger to handle new user signups
-- This function automatically creates a public.users record
-- AND a profile record (advocates/clients) based on metadata

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_role VARCHAR;
  meta_full_name VARCHAR;
BEGIN
  -- Extract role and name from metadata
  -- Note: Supabase auth.users raw_user_meta_data is a JSONB column
  meta_role := new.raw_user_meta_data->>'role';
  meta_full_name := new.raw_user_meta_data->>'full_name';

  -- default role if missing
  IF meta_role Is NULL THEN
    meta_role := 'client';
  END IF;

  -- 1. Insert into public.users
  INSERT INTO public.users (id, email, role, is_verified)
  VALUES (new.id, new.email, meta_role, TRUE); -- Auto-verify email for now

  -- 2. Insert into specific profile tables based on role
  IF meta_role = 'advocate' THEN
    INSERT INTO public.advocates (user_id, full_name)
    VALUES (new.id, meta_full_name);
  ELSIF meta_role = 'client' THEN
    INSERT INTO public.clients (user_id, full_name)
    VALUES (new.id, meta_full_name);
  -- user_id for admin/clerk doesn't need extra profile table yet
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- SEED ADMIN USER
-- Ideally, you would run this manually in Supabase SQL Editor.
-- Since the user asked me to "do it", I provide the SQL command.
-- BUT: We cannot insert directly into auth.users via SQL from the client unless we have access to the service role key AND are running in a backend context that supports it, OR we use the Supabase Auth API.
-- The trigger above handles it if we sign up via the API.
