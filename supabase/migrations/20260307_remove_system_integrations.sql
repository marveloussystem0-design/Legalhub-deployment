-- Migration to remove system_integrations table as it is no longer used
-- The system now uses environment variables for service configurations.

DROP TABLE IF EXISTS public.system_integrations;
