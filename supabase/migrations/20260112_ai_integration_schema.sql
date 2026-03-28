-- AI Integration Schema
-- Migration: 20260112_ai_integration_schema.sql
-- Description: Creates tables for AI chat conversations, messages, and usage tracking

-- Enable UUID extension (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- AI Chat Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    title VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Chat Messages
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB, -- Store context, tokens used, model version, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Usage Tracking for cost monitoring
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    feature VARCHAR(100) NOT NULL, -- 'chat', 'document_draft', 'summarize', etc.
    tokens_used INTEGER,
    cost_estimate DECIMAL(10, 4),
    metadata JSONB, -- Additional context like model used, prompt type, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_case ON ai_conversations(case_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON ai_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_user_date ON ai_usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_feature ON ai_usage_logs(feature);

-- Row Level Security (RLS) Policies
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own conversations
CREATE POLICY "Users can view own conversations" ON ai_conversations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own conversations" ON ai_conversations
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations" ON ai_conversations
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own conversations" ON ai_conversations
    FOR DELETE USING (user_id = auth.uid());

-- Users can only view messages in their own conversations
CREATE POLICY "Users can view own messages" ON ai_messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT id FROM ai_conversations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in own conversations" ON ai_messages
    FOR INSERT WITH CHECK (
        conversation_id IN (
            SELECT id FROM ai_conversations WHERE user_id = auth.uid()
        )
    );

-- Users can view their own usage logs
CREATE POLICY "Users can view own usage logs" ON ai_usage_logs
    FOR SELECT USING (user_id = auth.uid());

-- System can insert usage logs
CREATE POLICY "System can insert usage logs" ON ai_usage_logs
    FOR INSERT WITH CHECK (true);

-- Admins can view all usage logs for monitoring
CREATE POLICY "Admins can view all usage logs" ON ai_usage_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger to update updated_at timestamp for ai_conversations
CREATE OR REPLACE FUNCTION update_ai_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_conversations_timestamp BEFORE UPDATE ON ai_conversations
    FOR EACH ROW EXECUTE FUNCTION update_ai_conversations_updated_at();
