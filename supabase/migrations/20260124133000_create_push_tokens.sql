-- Create table for storing Expo Push Tokens
create table if not exists public.user_push_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null,
  device_type text check (device_type in ('ios', 'android', 'web')),
  last_used_at timestamptz default now(),
  created_at timestamptz default now(),
  
  -- Prevent duplicate tokens for the same user
  constraint user_push_tokens_token_user_key unique(user_id, token)
);

-- Enable RLS
alter table public.user_push_tokens enable row level security;

-- Policies
create policy "Users can insert their own push tokens"
  on public.user_push_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own push tokens"
  on public.user_push_tokens for select
  using (auth.uid() = user_id);

create policy "Users can update their own push tokens"
  on public.user_push_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete their own push tokens"
  on public.user_push_tokens for delete
  using (auth.uid() = user_id);

-- Service Role (Admin) policies are implicit bypass in Supabase
-- No trigger function needed as upsert is handled by client logic
