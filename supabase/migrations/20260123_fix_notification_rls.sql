-- FIX & VERIFY: Notification RLS + Test
-- 1. Fix the RLS Policy so you can mark items as read
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. Send a "Verification" Notification
DO $$
DECLARE
    target_user_id uuid;
BEGIN
    SELECT id INTO target_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;

    IF target_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id, title, message, type, category, is_read, metadata
        ) VALUES (
            target_user_id,
            '✅ Permission Fixed',
            'You should now be able to mark this as read, and it will STAY read! Give it a try.',
            'success',
            'system',
            false,
            '{"test": "rls_verification"}'::jsonb
        );
    END IF;
END $$;
