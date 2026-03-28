-- Seed default News RSS settings
INSERT INTO public.system_settings (setting_key, setting_value, description, is_encrypted)
VALUES 
('news_rss_url_1', 'https://news.google.com/rss/search?q=Supreme+Court+of+India+Judgments+site:livelaw.in+OR+site:barandbench.com&hl=en-IN&gl=IN&ceid=IN:en', 'Primary RSS feed for legal news (e.g. Supreme Court)', false),
('news_rss_url_2', 'https://news.google.com/rss/search?q=High+Court+India+Legal+News+site:livelaw.in+OR+site:barandbench.com&hl=en-IN&gl=IN&ceid=IN:en', 'Secondary RSS feed for legal news (e.g. High Court)', false)
ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description;
