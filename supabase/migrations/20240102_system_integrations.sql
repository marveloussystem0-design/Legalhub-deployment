-- Create system_integrations table
CREATE TABLE IF NOT EXISTS public.system_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- e.g., 'aws', 'razorpay', 'openai'
    type VARCHAR(50) NOT NULL, -- e.g., 'storage', 'payment', 'ai'
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    config JSONB DEFAULT '{}'::jsonb, -- encrypted keys should go here conceptually, but for demo/MVP we might store refs
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_integrations ENABLE ROW LEVEL SECURITY;

-- Only Admins can view/edit integrations
CREATE POLICY "Admins can do everything on integrations" ON public.system_integrations
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM public.users WHERE role = 'admin'
        )
    );
