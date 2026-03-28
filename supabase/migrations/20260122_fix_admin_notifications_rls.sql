-- Fix Admin Notifications RLS Policy Security Issue
-- Date: 2026-01-22
-- Purpose: Replace insecure INSERT policy with proper admin-only authorization

-- Drop the existing insecure policy that allows any authenticated user
DROP POLICY IF EXISTS "Admins can insert notifications" ON admin_notifications;

-- Create secure policy that verifies admin role from user_profiles
CREATE POLICY "Admins can insert notifications"
ON admin_notifications FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Verification: Check that the policy was created correctly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_notifications' 
    AND policyname = 'Admins can insert notifications'
  ) THEN
    RAISE NOTICE '✅ Policy "Admins can insert notifications" created successfully';
  ELSE
    RAISE EXCEPTION '❌ Policy creation failed';
  END IF;
END $$;

-- Display the policy for verification
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'admin_notifications'
ORDER BY policyname;
