-- Legal Knowledge Base: Acts and Statutes
-- Migration: 20260112_legal_acts_schema.sql
-- Description: Creates tables for Indian Acts, Statutes, and their sections

-- Enable UUID extension (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Indian Acts and Statutes
CREATE TABLE IF NOT EXISTS legal_acts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    act_name VARCHAR(500) NOT NULL,
    act_number VARCHAR(100),
    year INTEGER,
    category VARCHAR(100), -- 'Central Act', 'State Act', etc.
    state VARCHAR(100), -- NULL for Central Acts
    description TEXT,
    full_text TEXT,
    source_url VARCHAR(500),
    last_updated DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Act Sections for granular search
CREATE TABLE IF NOT EXISTS legal_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    act_id UUID REFERENCES legal_acts(id) ON DELETE CASCADE,
    section_number VARCHAR(50) NOT NULL,
    section_title VARCHAR(500),
    section_text TEXT NOT NULL,
    parent_section_id UUID REFERENCES legal_sections(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_acts_search ON legal_acts USING GIN(
    to_tsvector('english', act_name || ' ' || COALESCE(description, ''))
);
CREATE INDEX IF NOT EXISTS idx_sections_search ON legal_sections USING GIN(
    to_tsvector('english', COALESCE(section_title, '') || ' ' || section_text)
);
CREATE INDEX IF NOT EXISTS idx_acts_year ON legal_acts(year);
CREATE INDEX IF NOT EXISTS idx_acts_category ON legal_acts(category);
CREATE INDEX IF NOT EXISTS idx_sections_act_id ON legal_sections(act_id);

-- Row Level Security (RLS) Policies
ALTER TABLE legal_acts ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_sections ENABLE ROW LEVEL SECURITY;

-- Public read access for all authenticated users (legal content is public)
CREATE POLICY "Authenticated users can view all acts" ON legal_acts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view all sections" ON legal_sections
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can insert/update/delete legal acts
CREATE POLICY "Admins can insert acts" ON legal_acts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update acts" ON legal_acts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete acts" ON legal_acts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins can insert/update/delete legal sections
CREATE POLICY "Admins can insert sections" ON legal_sections
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update sections" ON legal_sections
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete sections" ON legal_sections
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger to update updated_at timestamp for legal_acts
CREATE OR REPLACE FUNCTION update_legal_acts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_legal_acts_timestamp BEFORE UPDATE ON legal_acts
    FOR EACH ROW EXECUTE FUNCTION update_legal_acts_updated_at();
