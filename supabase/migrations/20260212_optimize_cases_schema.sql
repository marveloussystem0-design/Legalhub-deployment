-- Phase 4.5: Database Scalability Optimization (10k+ Cases)

-- 1. Performance Indexes for Dashboard Filtering
-- Critical for the "Upcoming Hearings" widget which filters by date
CREATE INDEX IF NOT EXISTS idx_cases_next_hearing_date 
ON cases(next_hearing_date) 
WHERE next_hearing_date IS NOT NULL; 

-- Critical for "My Cases" list filtering/sorting
CREATE INDEX IF NOT EXISTS idx_cases_status 
ON cases(status);

-- Critical for "Add Case via CNR" lookup speed (avoid full table scans)
CREATE INDEX IF NOT EXISTS idx_cases_cnr_number 
ON cases(cnr_number) 
WHERE cnr_number IS NOT NULL;

-- Critical for internal deduplication logic
CREATE INDEX IF NOT EXISTS idx_cases_cino 
ON cases(cino) 
WHERE cino IS NOT NULL;

-- 2. Data Integrity Constraints
-- Ensure that if a case is not linked to a user (e.g. future system scraped case), it MUST have an official ID
ALTER TABLE cases 
DROP CONSTRAINT IF EXISTS chk_case_identifier_presence;

ALTER TABLE cases 
ADD CONSTRAINT chk_case_identifier_presence 
CHECK (
  (cnr_number IS NOT NULL AND cnr_number <> '') OR 
  (cino IS NOT NULL AND cino <> '') OR 
  (created_by IS NOT NULL)
);

-- Ensure metadata is always a valid JSON object (prevent null or array root)
ALTER TABLE cases 
DROP CONSTRAINT IF EXISTS chk_metadata_is_object;

ALTER TABLE cases 
ADD CONSTRAINT chk_metadata_is_object 
CHECK (jsonb_typeof(COALESCE(metadata, '{}'::jsonb)) = 'object');

-- 3. Optimize Text Search (Optional Future Proofing)
-- Add GIN index for title search if we ever do full text search on it
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_cases_title_trgm 
ON cases USING gin (title gin_trgm_ops);

COMMENT ON INDEX idx_cases_next_hearing_date IS 'Optimizes Upcoming Hearings dashboard widget';
COMMENT ON INDEX idx_cases_status IS 'Optimizes filtering by Open/Closed status';
COMMENT ON INDEX idx_cases_title_trgm IS 'Optimizes fuzzy search for case titles';
