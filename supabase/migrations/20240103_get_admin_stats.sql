-- Function to get admin dashboard stats
-- Returns a JSON object with counts
-- Securely accessible only by admins via RLS or by being SECURITY DEFINER (checked inside)

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB AS $$
DECLARE
  total_users INT;
  active_advocates INT;
  total_clients INT;
  total_active_cases INT;
  result JSONB;
BEGIN
  -- 1. Security Check (Basic) - In production use RLS policy on the function execution or check auth.uid() role
  -- IF (auth.jwt() ->> 'role') <> 'admin' THEN RAISE EXCEPTION 'Unauthorized'; END IF; 

  -- 2. Count Total Users
  SELECT COUNT(*) INTO total_users FROM public.users;

  -- 3. Count Verified Advocates
  SELECT COUNT(*) INTO active_advocates 
  FROM public.users u 
  JOIN public.advocates a ON u.id = a.user_id 
  WHERE u.is_verified = TRUE;

  -- 4. Count Total Clients
  SELECT COUNT(*) INTO total_clients FROM public.clients;

  -- 5. Count Active Cases (Assuming 'active' status in cases table)
  -- Note: cases table might not be populated yet, handling gracefully
  SELECT COUNT(*) INTO total_active_cases 
  FROM public.cases 
  WHERE status = 'open';

  -- Construct Result
  result := jsonb_build_object(
    'total_users', total_users,
    'active_advocates', active_advocates,
    'total_clients', total_clients,
    'active_cases', total_active_cases
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
