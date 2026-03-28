-- 1. Add Outcome Column to Cases
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS outcome TEXT CHECK (outcome IN ('won', 'lost', 'settled', 'dismissed', 'other')),
ADD COLUMN IF NOT EXISTS outcome_date TIMESTAMPTZ;

-- 2. Create Specializations Table (Standardized System)
CREATE TABLE IF NOT EXISTS public.specializations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    label TEXT NOT NULL UNIQUE, -- e.g. "Criminal"
    value TEXT NOT NULL UNIQUE, -- e.g. "criminal" (for matching case_type)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Specializations (Matching Create Case Modal)
INSERT INTO public.specializations (label, value) VALUES
('Civil Law', 'civil'),
('Criminal Law', 'criminal'),
('Family Law', 'family'),
('Corporate Law', 'corporate'),
('Property Law', 'property'),
('Tax Law', 'tax'),
('Immigration', 'immigration'),
('Intellectual Property', 'ipr'),
('Consumer Protection', 'consumer')
ON CONFLICT (value) DO NOTHING;

-- 3. Update RLS for Advocates (Enable Public Directory)
-- Existing policies might restrict access. We need a "Public Read" policy.

-- First, drop conflicting policies if they exist (safe-gaurd)
-- DROP POLICY IF EXISTS "Advocates are viewable by everyone" ON public.advocates;
-- DROP POLICY IF EXISTS "Advocates can view their own profile" ON public.advocates;

-- Policy: Allow ANY authenticated user (client or advocate) to VIEW all advocates
-- This is essential for the directory to work.
CREATE POLICY "Enable read access for all users" ON public.advocates
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Allow public (anon) read access? (Optional, if you want SEO pages)
-- For now, restricted to logged-in users.

-- 4. Enable RLS on Specializations (Read Only for everyone)
ALTER TABLE public.specializations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Specializations viewable by everyone" ON public.specializations
    FOR SELECT
    USING (true);
