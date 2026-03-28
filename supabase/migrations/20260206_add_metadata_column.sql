alter table cases add column if not exists metadata jsonb default '{}'::jsonb;
