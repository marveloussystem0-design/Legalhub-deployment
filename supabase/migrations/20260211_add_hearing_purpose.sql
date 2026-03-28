-- Fix: Add missing purpose column to case_hearings table
-- This column is used to store the hearing purpose/reason

ALTER TABLE case_hearings 
ADD COLUMN IF NOT EXISTS purpose TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_case_hearings_purpose 
ON case_hearings(purpose) 
WHERE purpose IS NOT NULL;
