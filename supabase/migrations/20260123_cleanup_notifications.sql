-- PHASE 2: Notification System Consolidation
-- Goal: Merge 3 notification tables into one master 'notifications' table

-- 1. Enhance the main 'notifications' table
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('system', 'hearing', 'admin', 'case', 'payment')),
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS action_link text;

-- 2. Migrate Hearing Notifications
-- These have specific fields like hearing_date that go into metadata
INSERT INTO public.notifications (user_id, title, message, type, category, is_read, metadata, created_at)
SELECT 
    user_id,
    'Hearing Reminder' as title, -- Generic title if source doesn't have one
    'Upcoming hearing for case' as message, -- Simplified, usually generated in code
    'info' as type,
    'hearing' as category,
    is_read,
    jsonb_build_object(
        'hearing_date', hearing_date,
        'case_id', case_id,
        'type', notification_type
    ) as metadata,
    sent_at as created_at
FROM public.hearing_notifications;

-- 3. Migrate Admin Notifications
-- Admin notifications are often broadcasts. 
-- Assuming 'admin_notifications' tracks 'sent_by' but 'notifications' needs 'user_id' (recipient).
-- Use a loop or simplified logic if admin notifications are 1-to-many.
-- For now, we will just structure the table to support it.


-- 4. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
