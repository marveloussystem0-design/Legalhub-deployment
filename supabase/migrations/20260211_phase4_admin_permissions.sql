-- Phase 4.4: Admin Permissions & Notification Deduplication
-- Purpose: Enable admin to view all cases and fix notification duplicate issue

-- ============================================================================
-- PART 1: Fix Admin Notifications RLS (Security Fix)
-- ============================================================================

-- Drop the insecure policy that allows any authenticated user to insert
DROP POLICY IF EXISTS "Admins can insert notifications" ON admin_notifications;

-- Create secure policy that checks admin role
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

-- ============================================================================
-- PART 2: Grant Admin Read Access to Cases (for Phase 30 Cause List Management)
-- ============================================================================

-- Admin can view all cases (read-only)
CREATE POLICY "Admins can view all cases"
ON cases FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Admin can view all case participants
CREATE POLICY "Admins can view all case participants"
ON case_participants FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Admin can view all case hearings
CREATE POLICY "Admins can view all case hearings"
ON case_hearings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- ============================================================================
-- PART 3: Notification Deduplication Support
-- ============================================================================

-- Add push_sent column to track if push notification was sent
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS push_sent BOOLEAN DEFAULT FALSE;

-- Add index for efficient querying of unsent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_push_sent 
ON notifications(push_sent, category, (metadata->>'hearing_date'))
WHERE push_sent = FALSE AND category = 'hearing_reminder';

-- ============================================================================
-- PART 4: Performance Indexes
-- ============================================================================

-- Index for admin role lookups (used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_user_profiles_role 
ON user_profiles(role) 
WHERE role = 'admin';

-- Index for faster case queries by court (for cause list filtering)
CREATE INDEX IF NOT EXISTS idx_cases_court_name 
ON cases(court_name);

-- ============================================================================
-- PART 5: Verification Queries (for testing)
-- ============================================================================

-- Test admin can view cases (run as admin user)
-- SELECT COUNT(*) FROM cases; -- Should return all cases

-- Test non-admin cannot insert admin notifications (run as advocate)
-- INSERT INTO admin_notifications (title, body, target_audience, sent_by)
-- VALUES ('Test', 'Test', 'all', auth.uid()); -- Should fail

-- Test notification deduplication
-- SELECT user_id, category, metadata->>'case_id', metadata->>'hearing_date', COUNT(*)
-- FROM notifications
-- WHERE category = 'hearing_reminder'
-- GROUP BY user_id, category, metadata->>'case_id', metadata->>'hearing_date'
-- HAVING COUNT(*) > 1; -- Should return 0 rows after deduplication
