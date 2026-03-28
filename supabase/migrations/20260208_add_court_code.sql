-- Add court_code to cases table for Smart Sync
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS court_code TEXT DEFAULT '1';

-- Index for fast lookup of active courts
CREATE INDEX IF NOT EXISTS idx_cases_court_code ON cases(court_code);
