-- Create table for storing Advocate Name Variations (Aliases)
-- This is used for "Hybrid Matching" when scraping Cause Lists
-- Case 1: Exact Match via bar_council_number (in advocates table)
-- Case 2: Fuzzy/Alias Match via this table

CREATE TABLE IF NOT EXISTS advocate_court_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advocate_id UUID NOT NULL REFERENCES advocates(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    court_identifier VARCHAR(100), -- Optional: context (e.g., 'MHC', 'Madurai Bench')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate aliases for the same advocate
    UNIQUE(advocate_id, alias)
);

-- Indexes for fast matching
CREATE INDEX IF NOT EXISTS idx_advocate_aliases_alias ON advocate_court_aliases(alias); 
CREATE INDEX IF NOT EXISTS idx_advocate_aliases_advocate_id ON advocate_court_aliases(advocate_id);

-- Enable RLS
ALTER TABLE advocate_court_aliases ENABLE ROW LEVEL SECURITY;

-- Policies

-- 1. Advocates can view their own aliases
DROP POLICY IF EXISTS "Advocates can view own aliases" ON advocate_court_aliases;
CREATE POLICY "Advocates can view own aliases" ON advocate_court_aliases
    FOR SELECT
    USING (
        advocate_id IN (
            SELECT id FROM advocates WHERE user_id = auth.uid()
        )
    );

-- 2. Advocates can insert their own aliases
DROP POLICY IF EXISTS "Advocates can insert own aliases" ON advocate_court_aliases;
CREATE POLICY "Advocates can insert own aliases" ON advocate_court_aliases
    FOR INSERT
    WITH CHECK (
        advocate_id IN (
            SELECT id FROM advocates WHERE user_id = auth.uid()
        )
    );

-- 3. Advocates can update their own aliases
DROP POLICY IF EXISTS "Advocates can update own aliases" ON advocate_court_aliases;
CREATE POLICY "Advocates can update own aliases" ON advocate_court_aliases
    FOR UPDATE
    USING (
        advocate_id IN (
            SELECT id FROM advocates WHERE user_id = auth.uid()
        )
    );

-- 4. Advocates can delete their own aliases
DROP POLICY IF EXISTS "Advocates can delete own aliases" ON advocate_court_aliases;
CREATE POLICY "Advocates can delete own aliases" ON advocate_court_aliases
    FOR DELETE
    USING (
        advocate_id IN (
            SELECT id FROM advocates WHERE user_id = auth.uid()
        )
    );

-- 5. Admins can view all aliases (for matching logic debugging)
-- Assuming 'admin' role check is strictly handled in app logic or separate policy
-- For now, we keep it tight.
