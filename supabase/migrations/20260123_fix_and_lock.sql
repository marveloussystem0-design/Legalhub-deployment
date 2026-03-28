-- FIX & RE-LOCK
-- 1. Fix is_admin() search_path to include 'extensions' (where auth.uid() often lives)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- 2. Re-Apply RLS (The script that failed before, now safe)
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

-- 3. Ensure Policies exist (Re-run key policies just in case they were dropped/lost)
-- PROFILES
DROP POLICY IF EXISTS "Public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Edit own profile" ON public.profiles;
CREATE POLICY "Public profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Edit own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- CASES
DROP POLICY IF EXISTS "Access own/assigned cases" ON public.cases;
CREATE POLICY "Access own/assigned cases" ON public.cases FOR ALL 
USING (
  created_by = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.case_participants WHERE case_id = id AND user_id = auth.uid()) OR
  public.is_admin()
);

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Own notifications" ON public.notifications;
CREATE POLICY "Own notifications" ON public.notifications FOR ALL USING (user_id = auth.uid());
