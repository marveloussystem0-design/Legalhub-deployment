-- Fix for system_settings table (handles case where table already exists)

-- Only create table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  description TEXT,
  is_encrypted BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings (ignore if already exist)
INSERT INTO system_settings (setting_key, setting_value, description, is_encrypted)
VALUES 
  ('ecourts_api_key', NULL, 'API Key for eCourts integration (Third-party provider)', true),
  ('ecourts_api_base_url', 'https://api.ecourts.gov.in/v1', 'Base URL for eCourts API', false)
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS if not already enabled
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON system_settings;
DROP POLICY IF EXISTS "Allow service role to manage settings" ON system_settings;

-- Recreate policies
CREATE POLICY "Allow authenticated users to read settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role to manage settings"
  ON system_settings
  FOR ALL
  TO service_role
  USING (true);

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- Drop and recreate trigger function
DROP TRIGGER IF EXISTS trigger_update_system_settings_timestamp ON system_settings;
DROP FUNCTION IF EXISTS update_system_settings_timestamp();

CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_system_settings_timestamp
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_timestamp();
