-- Migration: Add eCourts Integration Tables

-- 1. eCourts Synced Cases (Stores raw data from API)
CREATE TABLE IF NOT EXISTS ecourts_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cnr_number VARCHAR(30) UNIQUE NOT NULL,
    case_number VARCHAR(100),
    case_type VARCHAR(100),
    filing_date DATE,
    registration_date DATE,
    status VARCHAR(50),
    petitioner VARCHAR(255),
    respondent VARCHAR(255),
    court_name VARCHAR(255),
    state_code VARCHAR(10),
    district_code VARCHAR(10),
    next_hearing_date DATE,
    next_hearing_time VARCHAR(20),
    judge_name VARCHAR(255),
    stage_of_case VARCHAR(100),
    raw_data JSONB, -- Stores full API response
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Link Table (Connects your 'cases' to 'ecourts_cases')
CREATE TABLE IF NOT EXISTS case_ecourts_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    ecourts_case_id UUID REFERENCES ecourts_cases(id) ON DELETE CASCADE,
    linked_by UUID REFERENCES users(id),
    auto_sync_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(case_id, ecourts_case_id)
);

-- 3. Sync Log (Tracks success/failure of daily jobs)
CREATE TABLE IF NOT EXISTS ecourts_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ecourts_case_id UUID REFERENCES ecourts_cases(id) ON DELETE CASCADE,
    sync_type VARCHAR(20) CHECK (sync_type IN ('scheduled', 'manual', 'bulk_import')),
    status VARCHAR(20) CHECK (status IN ('success', 'failed', 'partial')),
    changes_detected JSONB, -- Stores what fields changed (e.g. { "next_hearing": "old->new" })
    error_message TEXT,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. VC Meeting Links (Stores scraped data)
CREATE TABLE IF NOT EXISTS vc_meeting_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    court_name VARCHAR(255) NOT NULL,
    district VARCHAR(100),
    meeting_link TEXT NOT NULL,
    meeting_platform VARCHAR(50) DEFAULT 'Microsoft Teams',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(court_name, district)
);

-- 5. Hearing Notifications (Tracks alerts sent to advocates)
CREATE TABLE IF NOT EXISTS hearing_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    hearing_date DATE NOT NULL,
    notification_type VARCHAR(50) CHECK (notification_type IN ('tomorrow_hearing', 'case_update', 'new_case_detected')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_ecourts_cnr ON ecourts_cases(cnr_number);
CREATE INDEX IF NOT EXISTS idx_ecourts_hearing_date ON ecourts_cases(next_hearing_date);
CREATE INDEX IF NOT EXISTS idx_links_case_id ON case_ecourts_links(case_id);
CREATE INDEX IF NOT EXISTS idx_vc_links_court ON vc_meeting_links(court_name);

-- RLS Policies
ALTER TABLE ecourts_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_ecourts_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecourts_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE vc_meeting_links ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view eCourts data (public info)
DROP POLICY IF EXISTS "Authenticated users can view ecourts cases" ON ecourts_cases;
CREATE POLICY "Authenticated users can view ecourts cases" ON ecourts_cases
    FOR SELECT USING (auth.role() = 'authenticated');

-- Users can only view links for cases they have access to
DROP POLICY IF EXISTS "Users view own case links" ON case_ecourts_links;
CREATE POLICY "Users view own case links" ON case_ecourts_links
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cases 
            WHERE cases.id = case_ecourts_links.case_id 
            AND (cases.created_by = auth.uid() OR 
                 EXISTS (SELECT 1 FROM case_participants WHERE case_id = cases.id AND user_id = auth.uid()))
        )
    );

-- Users can insert links (when they link a case)
DROP POLICY IF EXISTS "Users can insert case links" ON case_ecourts_links;
CREATE POLICY "Users can insert case links" ON case_ecourts_links
    FOR INSERT WITH CHECK (auth.uid() = linked_by);

-- Everyone can view VC links
DROP POLICY IF EXISTS "Everyone can view VC links" ON vc_meeting_links;
CREATE POLICY "Everyone can view VC links" ON vc_meeting_links
    FOR SELECT USING (auth.role() = 'authenticated');

-- Timestamps Triggers
CREATE TRIGGER update_ecourts_cases_updated_at BEFORE UPDATE ON ecourts_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
