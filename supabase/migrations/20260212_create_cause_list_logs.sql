-- Create cause_list_logs table to track processing history
CREATE TABLE IF NOT EXISTS cause_list_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    court_code VARCHAR(255) NOT NULL,
    scrape_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    cases_found INTEGER DEFAULT 0,
    cases_matched INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cause_list_logs_court ON cause_list_logs(court_code);
CREATE INDEX IF NOT EXISTS idx_cause_list_logs_date ON cause_list_logs(scrape_date DESC);
CREATE INDEX IF NOT EXISTS idx_cause_list_logs_status ON cause_list_logs(status);

-- RLS Policies (Admin only)
ALTER TABLE cause_list_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
DROP POLICY IF EXISTS "Admins can view all cause list logs" ON cause_list_logs;
CREATE POLICY "Admins can view all cause list logs"
    ON cause_list_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admin can insert logs
DROP POLICY IF EXISTS "Admins can insert cause list logs" ON cause_list_logs;
CREATE POLICY "Admins can insert cause list logs"
    ON cause_list_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admin can update logs
DROP POLICY IF EXISTS "Admins can update cause list logs" ON cause_list_logs;
CREATE POLICY "Admins can update cause list logs"
    ON cause_list_logs
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS cause_list_logs_updated_at ON cause_list_logs;
DROP FUNCTION IF EXISTS update_cause_list_logs_updated_at();

CREATE OR REPLACE FUNCTION update_cause_list_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cause_list_logs_updated_at
    BEFORE UPDATE ON cause_list_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_cause_list_logs_updated_at();
