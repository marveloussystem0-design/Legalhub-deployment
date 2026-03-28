-- Migration to cleanup admin infrastructure
-- 1. Remove the unused system_integrations table
DROP TABLE IF EXISTS public.system_integrations;

-- 2. Clean up redundant eCourts API settings from system_settings
-- We keep the table and other settings (like News RSS) for future use.
DELETE FROM public.system_settings 
WHERE setting_key IN ('ecourts_api_key', 'ecourts_api_base_url');
