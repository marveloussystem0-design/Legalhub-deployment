-- Create table to track cause list scraping runs
CREATE TABLE IF NOT EXISTS public.cause_list_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    court_code TEXT NOT NULL,
    scrape_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'success', 'failed')),
    cases_found INTEGER DEFAULT 0,
    matches_found INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure we don't scrape the same court for the same date multiple times efficiently
    UNIQUE(court_code, scrape_date)
);

-- Enable RLS
ALTER TABLE public.cause_list_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to view logs
CREATE POLICY "Admins can view cause list logs"
ON public.cause_list_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Allow service role (scraper) to insert/update
-- Note: Service role bypasses RLS, but explicit policy is good practice
CREATE POLICY "Service role can manage logs"
ON public.cause_list_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Index for efficient lookups by date and status
CREATE INDEX idx_cause_list_logs_date_status ON public.cause_list_logs(scrape_date, status);
CREATE INDEX idx_cause_list_logs_court_code ON public.cause_list_logs(court_code);
