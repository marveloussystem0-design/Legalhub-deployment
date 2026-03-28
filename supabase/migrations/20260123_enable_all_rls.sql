-- SECURITY HARDENING: Enable RLS on ALL tables
-- Fixes Supabase Linter errors AND prevents workflow blockage

-- 1. Enable RLS (The Linter Fix)
ALTER TABLE public.case_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 2. CRITICAL: Ensure Advocates can still see their Clients
-- Drop potential restrictive policies first
DROP POLICY IF EXISTS "Advocates see clients via cases" ON public.clients;

-- Allow read access if the client is part of a case the advocate created
CREATE POLICY "Advocates see clients via cases"
ON public.clients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.case_participants cp
    JOIN public.cases c ON c.id = cp.case_id
    WHERE cp.user_id = clients.user_id -- The client is in the case
    AND (
      c.created_by = auth.uid() -- The case was created by this advocate
      OR 
      EXISTS ( -- OR the advocate is also a participant in the query user's case (e.g. assigned)
        SELECT 1 FROM public.case_participants cp2 
        WHERE cp2.case_id = c.id AND cp2.user_id = auth.uid()
      )
    )
  )
);

-- 3. Payments & Subscriptions (Own Data Only)
DROP POLICY IF EXISTS "Users view own payments" ON public.payments;
CREATE POLICY "Users view own payments" ON public.payments FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users view own subscriptions" ON public.subscriptions FOR SELECT USING (user_id = auth.uid());

-- 4. Legacy Tables (Lockdown)
ALTER TABLE public.hearing_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Legacy: No access" ON public.hearing_notifications;
CREATE POLICY "Legacy: No access" ON public.hearing_notifications FOR ALL USING (false);
