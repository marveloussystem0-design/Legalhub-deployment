-- TEMPLATE MANAGEMENT SYSTEM
-- Supports both system templates (imported from DOCX) and user-created templates

-- 1. Create templates table
CREATE TABLE IF NOT EXISTS public.draft_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    category text,
    content text NOT NULL,
    is_system boolean DEFAULT false, -- true for imported templates, false for user-created
    created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE, -- null for system templates
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Create index for fast searching
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.draft_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_title ON public.draft_templates USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON public.draft_templates(created_by);

-- 3. Enable RLS
ALTER TABLE public.draft_templates ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (Enhanced Security)

-- SELECT: System templates are public, users see their own
DROP POLICY IF EXISTS "View templates" ON public.draft_templates;
CREATE POLICY "View templates" 
ON public.draft_templates FOR SELECT 
USING (
  is_system = true OR 
  created_by = auth.uid() OR 
  public.is_admin()
);

-- INSERT: Only authenticated users can create templates, never as system
DROP POLICY IF EXISTS "Users create templates" ON public.draft_templates;
CREATE POLICY "Users create templates" 
ON public.draft_templates FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND
  created_by = auth.uid() AND 
  is_system = false -- CRITICAL: Prevent privilege escalation
);

-- UPDATE: Users can only update their own non-system templates
DROP POLICY IF EXISTS "Users update own templates" ON public.draft_templates;
CREATE POLICY "Users update own templates" 
ON public.draft_templates FOR UPDATE 
USING (
  created_by = auth.uid() AND 
  is_system = false -- CRITICAL: System templates are immutable
)
WITH CHECK (
  created_by = auth.uid() AND 
  is_system = false -- CRITICAL: Cannot change to system template
);

-- DELETE: Users can only delete their own non-system templates
DROP POLICY IF EXISTS "Users delete own templates" ON public.draft_templates;
CREATE POLICY "Users delete own templates" 
ON public.draft_templates FOR DELETE 
USING (
  created_by = auth.uid() AND 
  is_system = false -- CRITICAL: System templates cannot be deleted
);

-- 5. Update timestamp trigger
CREATE OR REPLACE FUNCTION update_draft_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_draft_templates_timestamp ON public.draft_templates;
CREATE TRIGGER update_draft_templates_timestamp
    BEFORE UPDATE ON public.draft_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_draft_templates_updated_at();
