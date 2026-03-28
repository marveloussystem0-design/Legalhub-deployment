-- FINAL LOCKDOWN: Turn RLS back ON
-- Now that the Policies are fixed (Recursion blocked), we can safely lock the doors.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advocates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
-- Cases/Participants were already enabled by the fix script, but safe to run again
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hearing_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecourts_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- If this runs without error, reload your Dashboard. Data should be visible!
