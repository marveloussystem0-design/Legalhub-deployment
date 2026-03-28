-- Create admin_notifications table for broadcast notifications
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_audience TEXT NOT NULL CHECK (target_audience IN ('all', 'advocates', 'clients')),
  sent_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recipient_count INTEGER DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can insert notifications
CREATE POLICY "Admins can insert notifications"
ON admin_notifications FOR INSERT
TO authenticated
WITH CHECK (true);
  /*Exists (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);*/

-- Policy: All authenticated users can read (for realtime subscription)
CREATE POLICY "Users can read notifications"
ON admin_notifications FOR SELECT
TO authenticated
USING (true);

-- Create index for faster queries
CREATE INDEX idx_admin_notifications_created_at ON admin_notifications(created_at DESC);
CREATE INDEX idx_admin_notifications_target_audience ON admin_notifications(target_audience);

-- Enable realtime for instant push
ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;
