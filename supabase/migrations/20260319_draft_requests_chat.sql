-- Pro custom draft request workflow (chat-style) and advocate template authoring support.

CREATE TABLE IF NOT EXISTS public.draft_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.draft_request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.draft_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_draft_requests_user_created_at
  ON public.draft_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_draft_request_messages_request_created_at
  ON public.draft_request_messages(request_id, created_at ASC);

ALTER TABLE public.draft_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_request_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own or admin draft requests" ON public.draft_requests;
CREATE POLICY "Own or admin draft requests"
ON public.draft_requests FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Advocates create own draft requests" ON public.draft_requests;
CREATE POLICY "Advocates create own draft requests"
ON public.draft_requests FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin updates draft requests" ON public.draft_requests;
CREATE POLICY "Admin updates draft requests"
ON public.draft_requests FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Own or admin draft request messages" ON public.draft_request_messages;
CREATE POLICY "Own or admin draft request messages"
ON public.draft_request_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.draft_requests r
    WHERE r.id = draft_request_messages.request_id
      AND (r.user_id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "Own or admin insert draft request messages" ON public.draft_request_messages;
CREATE POLICY "Own or admin insert draft request messages"
ON public.draft_request_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.draft_requests r
    WHERE r.id = draft_request_messages.request_id
      AND (r.user_id = auth.uid() OR public.is_admin())
  )
);

CREATE OR REPLACE FUNCTION public.update_draft_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_draft_requests_timestamp ON public.draft_requests;
CREATE TRIGGER update_draft_requests_timestamp
BEFORE UPDATE ON public.draft_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_draft_requests_updated_at();

