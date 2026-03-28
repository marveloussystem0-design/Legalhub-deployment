-- Migration: Add scraping cache and logging tables
-- This minimizes database usage by caching scraped data for 24 hours
-- and provides audit trail for legal compliance

-- Table: scraper_cache
-- Purpose: Cache scraped data to minimize requests to eCourts
CREATE TABLE IF NOT EXISTS scraper_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_scraper_cache_key ON scraper_cache(cache_key);
CREATE INDEX idx_scraper_cache_expires ON scraper_cache(expires_at);

-- Table: scraper_logs
-- Purpose: Audit trail for scraping activity (legal compliance)
CREATE TABLE IF NOT EXISTS scraper_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scrape_type TEXT NOT NULL, -- 'case_details', 'cause_list', 'vc_links'
  target TEXT NOT NULL, -- CNR number, court code, etc.
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'cached')),
  error_message TEXT,
  response_time_ms INTEGER,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX idx_scraper_logs_timestamp ON scraper_logs(timestamp DESC);
CREATE INDEX idx_scraper_logs_type ON scraper_logs(scrape_type);
CREATE INDEX idx_scraper_logs_status ON scraper_logs(status);

-- Table: scraping_attributions
-- Purpose: Store source attributions for legal compliance
CREATE TABLE IF NOT EXISTS scraping_attributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  attribution_text TEXT NOT NULL,
  terms_of_service_url TEXT,
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Insert default attributions
INSERT INTO scraping_attributions (source_name, source_url, attribution_text, terms_of_service_url) VALUES
('eCourts Services India', 'https://services.ecourts.gov.in', 'Data sourced from eCourts Services (https://ecourts.gov.in) - publicly available court records accessed in compliance with the Right to Information Act, 2005 and Digital India Initiative.', 'https://ecourts.gov.in/ecourts_home/'),
('Chennai District Courts', 'https://chennai.dcourts.gov.in', 'VC Links sourced from Chennai District Courts official website.', 'https://chennai.dcourts.gov.in')
ON CONFLICT DO NOTHING;

-- Function: Clean expired cache (run daily)
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM scraper_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Get cache statistics
CREATE OR REPLACE FUNCTION get_cache_stats()
RETURNS TABLE (
  total_entries BIGINT,
  total_hits BIGINT,
  cache_size_mb NUMERIC,
  oldest_entry TIMESTAMPTZ,
  newest_entry TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_entries,
    SUM(hit_count)::BIGINT as total_hits,
    ROUND((pg_total_relation_size('scraper_cache')::NUMERIC / 1024 / 1024), 2) as cache_size_mb,
    MIN(cached_at) as oldest_entry,
    MAX(cached_at) as newest_entry
  FROM scraper_cache;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies (if needed)
ALTER TABLE scraper_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_attributions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read cache
CREATE POLICY "Authenticated users can read cache"
  ON scraper_cache FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage cache
CREATE POLICY "Service role can manage cache"
  ON scraper_cache FOR ALL
  TO service_role
  USING (true);

-- Allow authenticated users to read logs (for monitoring)
CREATE POLICY "Authenticated users can read logs"
  ON scraper_logs FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert logs
CREATE POLICY "Service role can insert logs"
  ON scraper_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow everyone to read attributions
CREATE POLICY "Everyone can read attributions"
  ON scraping_attributions FOR SELECT
  TO public
  USING (true);

COMMENT ON TABLE scraper_cache IS 'Caches scraped data for 24 hours to minimize requests to external sources';
COMMENT ON TABLE scraper_logs IS 'Audit trail of all scraping activities for legal compliance and monitoring';
COMMENT ON TABLE scraping_attributions IS 'Source attributions for legal compliance with data sources';
