-- Add eCourts columns to cases table
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS cino TEXT,
ADD COLUMN IF NOT EXISTS cnr_number TEXT,
ADD COLUMN IF NOT EXISTS petitioner_name TEXT,
ADD COLUMN IF NOT EXISTS respondent_name TEXT,
ADD COLUMN IF NOT EXISTS judge_name TEXT,
ADD COLUMN IF NOT EXISTS next_hearing_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_hearing_purpose TEXT,
ADD COLUMN IF NOT EXISTS disposal_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS disposal_nature TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_cino ON cases(cino);
CREATE INDEX IF NOT EXISTS idx_cases_cnr ON cases(cnr_number);
