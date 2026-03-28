-- Remove advocate court aliases feature and data.
-- This drops the storage table and dependent RLS objects/triggers via CASCADE.

drop table if exists public.advocate_court_aliases cascade;
