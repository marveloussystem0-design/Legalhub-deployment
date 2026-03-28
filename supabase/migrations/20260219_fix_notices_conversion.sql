-- Relax cases table constraints for Notice to Case conversion
-- 1. Relax status constraint to allow 'Pre-Admission'
ALTER TABLE cases 
DROP CONSTRAINT IF EXISTS cases_status_check;

ALTER TABLE cases 
ADD CONSTRAINT cases_status_check 
CHECK (status IN ('open', 'pending', 'closed', 'archived', 'Pre-Admission'));

-- 2. Make case_number nullable for pending cases
ALTER TABLE cases 
ALTER COLUMN case_number DROP NOT NULL;
