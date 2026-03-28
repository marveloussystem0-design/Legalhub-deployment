-- =====================================================
-- advocate_tips table
-- Run this in Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS public.advocate_tips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL CHECK (char_length(content) <= 200),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for active tips lookup (used by /api/tips)
CREATE INDEX IF NOT EXISTS idx_advocate_tips_active ON public.advocate_tips (is_active, created_at DESC);

-- Enable RLS
ALTER TABLE public.advocate_tips ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (advocates) to read active tips
CREATE POLICY "Authenticated users can read active tips"
    ON public.advocate_tips
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Allow admins to do everything
CREATE POLICY "Admins have full access to tips"
    ON public.advocate_tips
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
