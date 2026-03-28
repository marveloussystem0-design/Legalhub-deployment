-- System Settings Table for Admin-Managed Configuration
-- This stores API keys and other system-wide settings that can be changed without redeployment

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

-- Insert default eCourts API Key placeholder
INSERT INTO system_settings (setting_key, setting_value, description, is_encrypted)
VALUES 
  ('ecourts_api_key', NULL, 'API Key for eCourts integration (Third-party provider)', true),
  ('ecourts_api_base_url', 'https://api.ecourts.gov.in/v1', 'Base URL for eCourts API', false)
ON CONFLICT (setting_key) DO NOTHING;

-- RLS Policies: Only authenticated users can read, only admins can update
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read settings (they need it for features)
CREATE POLICY "Allow authenticated users to read settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow updates from users with admin role (we'll need to implement role checking)
-- For now, we'll allow the service role to update
CREATE POLICY "Allow service role to manage settings"
  ON system_settings
  FOR ALL
  TO service_role
  USING (true);

-- Create index for faster lookups
CREATE INDEX idx_system_settings_key ON system_settings(setting_key);

-- Add trigger to update updated_at timestamp
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
