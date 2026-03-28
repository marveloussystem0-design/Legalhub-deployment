-- Legal Knowledge Base: Judgments and Citations
-- Migration: 20260112_legal_judgments_schema.sql
-- Description: Creates tables for court judgments, citations, and user bookmarks

-- Enable UUID extension (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Court Judgments and Case Law
CREATE TABLE IF NOT EXISTS legal_judgments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_title VARCHAR(500) NOT NULL,
    case_number VARCHAR(200),
    court_name VARCHAR(255) NOT NULL,
    bench VARCHAR(255), -- e.g., "3-Judge Bench"
    judges TEXT[], -- Array of judge names
    judgment_date DATE,
    citation VARCHAR(500), -- e.g., "AIR 2023 SC 1234"
    petitioner VARCHAR(500),
    respondent VARCHAR(500),
    summary TEXT,
    full_text TEXT,
    headnotes TEXT,
    topics TEXT[], -- Legal topics/categories
    acts_referred TEXT[], -- Acts cited in judgment
    source_url VARCHAR(500),
    indiankanoon_doc_id VARCHAR(100), -- For API integration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Citations (references between judgments)
CREATE TABLE IF NOT EXISTS legal_citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    citing_judgment_id UUID REFERENCES legal_judgments(id) ON DELETE CASCADE,
    cited_judgment_id UUID REFERENCES legal_judgments(id) ON DELETE CASCADE,
    citation_context TEXT, -- How it was cited
    citation_type VARCHAR(50), -- 'followed', 'distinguished', 'overruled', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(citing_judgment_id, cited_judgment_id)
);

-- User bookmarks for legal content
CREATE TABLE IF NOT EXISTS legal_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL, -- 'act', 'judgment', 'section'
    resource_id UUID NOT NULL,
    notes TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, resource_type, resource_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_judgments_search ON legal_judgments USING GIN(
    to_tsvector('english', case_title || ' ' || COALESCE(summary, ''))
);
CREATE INDEX IF NOT EXISTS idx_judgments_court ON legal_judgments(court_name);
CREATE INDEX IF NOT EXISTS idx_judgments_date ON legal_judgments(judgment_date);
CREATE INDEX IF NOT EXISTS idx_judgments_topics ON legal_judgments USING GIN(topics);
CREATE INDEX IF NOT EXISTS idx_judgments_indiankanoon ON legal_judgments(indiankanoon_doc_id);
CREATE INDEX IF NOT EXISTS idx_citations_citing ON legal_citations(citing_judgment_id);
CREATE INDEX IF NOT EXISTS idx_citations_cited ON legal_citations(cited_judgment_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON legal_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_resource ON legal_bookmarks(resource_type, resource_id);

-- Row Level Security (RLS) Policies
ALTER TABLE legal_judgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_bookmarks ENABLE ROW LEVEL SECURITY;

-- Public read access for judgments (legal content is public)
CREATE POLICY "Authenticated users can view all judgments" ON legal_judgments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view all citations" ON legal_citations
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can insert/update/delete judgments
CREATE POLICY "Admins can insert judgments" ON legal_judgments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update judgments" ON legal_judgments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete judgments" ON legal_judgments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins can manage citations
CREATE POLICY "Admins can insert citations" ON legal_citations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update citations" ON legal_citations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete citations" ON legal_citations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can manage their own bookmarks
CREATE POLICY "Users can view own bookmarks" ON legal_bookmarks
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own bookmarks" ON legal_bookmarks
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own bookmarks" ON legal_bookmarks
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own bookmarks" ON legal_bookmarks
    FOR DELETE USING (user_id = auth.uid());

-- Trigger to update updated_at timestamp for legal_judgments
CREATE OR REPLACE FUNCTION update_legal_judgments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_legal_judgments_timestamp BEFORE UPDATE ON legal_judgments
    FOR EACH ROW EXECUTE FUNCTION update_legal_judgments_updated_at();
