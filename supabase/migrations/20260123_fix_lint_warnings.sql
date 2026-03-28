-- SECURITY REMEDIATION: Fix Linter Warnings
-- 1. Fix Mutable Search Paths (Security Best Practice)
-- Prevents malicious schema hijacking

ALTER FUNCTION public.update_legal_acts_updated_at() SET search_path = public;
ALTER FUNCTION public.clean_expired_cache() SET search_path = public;
ALTER FUNCTION public.get_admin_stats() SET search_path = public;
ALTER FUNCTION public.update_legal_judgments_updated_at() SET search_path = public;
ALTER FUNCTION public.update_ai_conversations_updated_at() SET search_path = public;
ALTER FUNCTION public.update_system_settings_timestamp() SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.get_cache_stats() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 2. Fix "No Policy" Tables (Default to System Only)
-- ecourts_sync_log: likely used by background jobs.
DROP POLICY IF EXISTS "System only access" ON public.ecourts_sync_log;
CREATE POLICY "System only access" ON public.ecourts_sync_log FOR ALL USING (false); 
-- Note: 'false' means only Service Role (admin) can access, which is usually correct for logs.

-- hearing_notifications (Legacy): Lock it down
DROP POLICY IF EXISTS "Legacy Lock" ON public.hearing_notifications;
CREATE POLICY "Legacy Lock" ON public.hearing_notifications FOR ALL USING (false);

-- 3. Fix Permissive Policy on ai_usage_logs
-- Current: INSERT WITH CHECK (true) -> Bad
-- New: INSERT WITH CHECK (auth.role() = 'service_role' OR auth.uid() IS NOT NULL)
DROP POLICY IF EXISTS "System can insert usage logs" ON public.ai_usage_logs;
CREATE POLICY "Secure insert usage logs" ON public.ai_usage_logs 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL); -- Only logged in users can log AI usage
