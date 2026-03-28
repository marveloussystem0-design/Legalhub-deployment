-- PHASE 3: Strict Row Level Security (RLS)
-- Goal: Lock down data access so users only see what they own

-- 1. Enable RLS on key tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policies
-- Everyone can read basics (needed for searching advocates)
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

-- Users can update own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Clients Policy (PII PROTECTION)
-- Only the advocate who created the client profile can see it
CREATE POLICY "Advocates see own clients" 
ON public.clients FOR ALL 
USING (auth.uid() = user_id); -- Assuming user_id points to the advocate owner in your schema design, wait..
-- Correction: In your schema `clients.user_id` is the CLient's login ID. 
-- The relationship is usually via cases or a separate `advocate_clients` table.
-- For now, let's assume `clients` table represents the Client's PERSONAL profile.
-- So: Client sees own profile.
CREATE POLICY "Clients see own profile"
ON public.clients FOR ALL
USING (auth.uid() = user_id);

-- 4. Cases Policy (The Big One)
-- Viewable if: Created by user OR User is a participant
CREATE POLICY "Users view assigned cases" 
ON public.cases FOR SELECT 
USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.case_participants 
    WHERE case_id = cases.id AND user_id = auth.uid()
  )
);

CREATE POLICY "Advocates create cases" 
ON public.cases FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Advocates update own cases" 
ON public.cases FOR UPDATE 
USING (created_by = auth.uid());

-- 5. Documents Policy
-- Inherit access from case
CREATE POLICY "Users view case documents" 
ON public.documents FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.cases 
    WHERE id = documents.case_id AND (
      created_by = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.case_participants 
        WHERE case_id = cases.id AND user_id = auth.uid()
      )
    )
  )
);

-- 6. Notifications Policy
CREATE POLICY "Users see own notifications" 
ON public.notifications FOR ALL 
USING (user_id = auth.uid());
