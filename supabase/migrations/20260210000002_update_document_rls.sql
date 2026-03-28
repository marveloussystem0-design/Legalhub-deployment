-- Phase 25 Step 3: Update RLS policies for client document access
-- This migration replaces the existing "Participants can view case documents" policy
-- with a new policy that distinguishes between advocate and client access

-- CRITICAL: This must be done atomically to avoid leaving the table without policies

BEGIN;

-- Step 1: Drop the old policy
DROP POLICY IF EXISTS "Participants can view case documents" ON documents;

-- Step 2: Create new policy with client/advocate distinction
CREATE POLICY "Role-based document access"
ON documents
FOR SELECT
TO authenticated
USING (
  -- Clients can only see documents explicitly shared with them in their cases
  (
    shared_with_client = true 
    AND case_id IN (
      SELECT case_id FROM case_participants 
      WHERE user_id = auth.uid() AND role = 'client'
    )
  )
  OR
  -- Advocates can see ALL documents in their assigned cases
  (
    case_id IN (
      SELECT case_id FROM case_participants 
      WHERE user_id = auth.uid() AND role = 'advocate'
    )
  )
  OR
  -- Document uploader can always see their own documents
  (
    uploaded_by = auth.uid()
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Role-based document access" ON documents IS 
'Clients see only shared documents in their cases. Advocates see all documents in their cases. Uploaders see their own documents.';

COMMIT;
