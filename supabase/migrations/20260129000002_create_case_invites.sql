-- Create case_invites table
CREATE TABLE IF NOT EXISTS public.case_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'client' CHECK (role IN ('client')),
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.case_invites ENABLE ROW LEVEL SECURITY;

-- 1. Advocate can view invites they sent
CREATE POLICY "Advocates can view their own invites"
ON public.case_invites FOR SELECT
USING (auth.uid() = invited_by);

-- 2. Advocate can create new invites
CREATE POLICY "Advocates can create invites"
ON public.case_invites FOR INSERT
WITH CHECK (auth.uid() = invited_by);

-- 3. Advocate can delete/cancel their own invites
CREATE POLICY "Advocates can delete their own invites"
ON public.case_invites FOR DELETE
USING (auth.uid() = invited_by);

-- 4. Service Role (Backend) bypasses RLS, so no policy needed for system actions.
-- However, if we want strictness, we can add a 'accepted' policy for users later, 
-- but for now the 'connect' logic happens on server side.
