-- Phase 25 Step 2: Add shared_with_client column to documents table
-- This migration adds a boolean column to control document visibility for clients
-- Default is FALSE to ensure existing documents remain advocate-only until explicitly shared

-- Add the shared_with_client column
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS shared_with_client BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN documents.shared_with_client IS 
'Controls whether this document is visible to clients. FALSE (default) = advocate-only, TRUE = shared with client';

-- Add index for performance when querying shared documents
CREATE INDEX IF NOT EXISTS idx_documents_shared 
ON documents(case_id, shared_with_client) 
WHERE shared_with_client = true;

COMMENT ON INDEX idx_documents_shared IS 
'Performance index for querying client-shared documents. Partial index only includes shared documents.';
