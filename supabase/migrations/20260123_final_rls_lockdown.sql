-- FINAL SECURITY LOCKDOWN: RLS IMPLEMENTATION
-- Based on Master RLS Analysis

-- 0. Helper Function for Admin Access (Prevents complex repetitive joins)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Enable RLS Globaly
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advocates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
-- Legacy Check
ALTER TABLE public.hearing_notifications ENABLE ROW LEVEL SECURITY;

-- 2. PROFILES
-- clean up old
DROP POLICY IF EXISTS "Public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Edit own profile" ON public.profiles;

CREATE POLICY "Public profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Edit own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- 3. CASES (The Core Access Model)
DROP POLICY IF EXISTS "Access own/assigned cases" ON public.cases;
DROP POLICY IF EXISTS "Admin view all cases" ON public.cases;

CREATE POLICY "Access own/assigned cases" ON public.cases FOR ALL 
USING (
  created_by = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.case_participants WHERE case_id = id AND user_id = auth.uid()) OR
  public.is_admin()
);

-- 4. CASE PARTICIPANTS (The Bridge)
DROP POLICY IF EXISTS "View participants of my cases" ON public.case_participants;

CREATE POLICY "View participants of my cases" ON public.case_participants FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND (c.created_by = auth.uid() OR public.is_admin())) OR
  user_id = auth.uid()
);

-- 5. CLIENTS (Strict PII Protection)
DROP POLICY IF EXISTS "Clients view own" ON public.clients;
DROP POLICY IF EXISTS "Advocatess view case clients" ON public.clients;

CREATE POLICY "Clients view own" ON public.clients FOR ALL USING (user_id = auth.uid());

-- Bridge Policy: Advocate can see Client IF they share a case
CREATE POLICY "Advocates view case clients" ON public.clients FOR SELECT
USING (
  public.is_admin() OR
  EXISTS (
    SELECT 1 FROM public.case_participants cp
    JOIN public.cases c ON c.id = cp.case_id
    WHERE cp.user_id = clients.user_id -- Client is in case
    AND (
      c.created_by = auth.uid() -- Advocate created case
      OR
      EXISTS (SELECT 1 FROM public.case_participants cp2 WHERE cp2.case_id = c.id AND cp2.user_id = auth.uid()) -- Advocate assigned
    )
  )
);

-- 6. CASE HEARINGS & DOCUMENTS (Inherit from Case)
-- Documents
DROP POLICY IF EXISTS "Access documents via case" ON public.documents;
CREATE POLICY "Access documents via case" ON public.documents FOR ALL
USING (
  public.is_admin() OR
  EXISTS (
    SELECT 1 FROM public.cases WHERE id = case_id AND (
      created_by = auth.uid() OR 
      EXISTS (SELECT 1 FROM public.case_participants WHERE case_id = cases.id AND user_id = auth.uid())
    )
  )
);

-- Hearings
DROP POLICY IF EXISTS "Access hearings via case" ON public.case_hearings;
CREATE POLICY "Access hearings via case" ON public.case_hearings FOR ALL
USING (
  public.is_admin() OR
  EXISTS (
    SELECT 1 FROM public.cases WHERE id = case_id AND (
      created_by = auth.uid() OR 
      EXISTS (SELECT 1 FROM public.case_participants WHERE case_id = cases.id AND user_id = auth.uid())
    )
  )
);

-- 7. FINANCIALS & NOTIFICATIONS (Simple Ownership)
DROP POLICY IF EXISTS "Own payments" ON public.payments;
CREATE POLICY "Own payments" ON public.payments FOR ALL USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Own subscriptions" ON public.subscriptions;
CREATE POLICY "Own subscriptions" ON public.subscriptions FOR ALL USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Own notifications" ON public.notifications;
CREATE POLICY "Own notifications" ON public.notifications FOR ALL USING (user_id = auth.uid());
