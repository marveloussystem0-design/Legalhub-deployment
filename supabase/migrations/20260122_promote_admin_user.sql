-- Promote law2@admin user to admin role
-- This migration sets the admin user role for testing

UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb), 
  '{role}', 
  '"admin"'::jsonb
)
WHERE email = 'law2@admin';

-- Also ensure user_profiles table has the admin record (if it exists)
-- Uncomment if user_profiles table exists with similar structure
-- INSERT INTO user_profiles (id, role)
-- SELECT id, 'admin' FROM auth.users WHERE email = 'law2@admin'
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';
