-- Ensure admin user deletion fully removes the Auth record so the same
-- email address can be registered again later.

CREATE OR REPLACE FUNCTION public.hard_delete_auth_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.users
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.hard_delete_auth_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hard_delete_auth_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.hard_delete_auth_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_auth_user(uuid) TO service_role;
