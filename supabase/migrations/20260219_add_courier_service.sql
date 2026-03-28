-- Add courier_service column to legal_notices
ALTER TABLE legal_notices 
ADD COLUMN IF NOT EXISTS courier_service TEXT DEFAULT 'India Post';
