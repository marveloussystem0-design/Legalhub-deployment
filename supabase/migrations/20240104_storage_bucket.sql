-- Create a new storage bucket for case documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-documents', 'case-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'case-documents');

-- Policy: Allow users to view their own uploaded files
-- A more strict approach is to only allow viewing if you have access to the Case
-- For MVP, we'll allow authenticated users to read files in the bucket,
-- trusting the App Layer (RLS on documents table) to only expose the URLs/Paths to the right people.
-- Since the bucket is PRIVATE (public=false), they need a Signed URL anyway.
CREATE POLICY "Authenticated users can view files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'case-documents');

-- Policy: Allow users to update/delete their own files
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'case-documents' AND owner = auth.uid());

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'case-documents' AND owner = auth.uid());
