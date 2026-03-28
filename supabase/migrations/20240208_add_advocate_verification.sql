
-- Migration to add Bar Council verification fields to 'advocates' table

ALTER TABLE advocates
ADD COLUMN IF NOT EXISTS bar_council_number TEXT,
ADD COLUMN IF NOT EXISTS bar_council_state TEXT,
ADD COLUMN IF NOT EXISTS bar_council_data JSONB;

-- Update RLS policies if necessary (assuming verified users can update their own data)
-- Existing policies likely cover 'active' users updating their own rows.
