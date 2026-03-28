-- Create legal_notices table
CREATE TABLE IF NOT EXISTS legal_notices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    client_id UUID REFERENCES clients(id),
    recipient_name TEXT NOT NULL,
    recipient_address TEXT,
    notice_date DATE DEFAULT CURRENT_DATE,
    sent_date DATE,
    delivery_status TEXT CHECK (delivery_status IN ('Draft', 'Sent', 'Delivered', 'Returned', 'Replied')) DEFAULT 'Draft',
    postal_tracking_number TEXT,
    reply_received BOOLEAN DEFAULT FALSE,
    reply_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE legal_notices ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Advocates manage own notices"
ON legal_notices FOR ALL
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_legal_notices_user_id ON legal_notices(user_id);
CREATE INDEX idx_legal_notices_client_id ON legal_notices(client_id);
