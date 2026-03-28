-- Create a key-value store for system settings
create table if not exists system_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table system_settings enable row level security;

-- Policy: Authenticated users can read settings
create policy "Authenticated users can read settings"
  on system_settings for select
  to authenticated
  using (true);

-- Policy: Only Admins can update settings
create policy "Admins can update settings"
  on system_settings for update
  to authenticated
  using (
    (select role from users where id = auth.uid()) = 'admin'
    OR
    (auth.jwt() ->> 'role') = 'admin' -- Fallback for service roles if any
  );

-- Insert initial rows for News
insert into system_settings (key, value, description)
values 
  ('news_rss_url_1', 'https://news.google.com/rss/search?q=Supreme+Court+of+India+when:2d&hl=en-IN&gl=IN&ceid=IN:en', 'Primary RSS Feed URL (e.g., Supreme Court News)'),
  ('news_rss_url_2', 'https://news.google.com/rss/search?q=High+Courts+India+Legal+News+when:2d&hl=en-IN&gl=IN&ceid=IN:en', 'Secondary RSS Feed URL (e.g., High Court News)');
