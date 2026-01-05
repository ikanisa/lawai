CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    external_id TEXT,
    category TEXT,
    city TEXT,
    address TEXT,
    country TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    phone TEXT,
    website TEXT,
    email TEXT,
    status TEXT,
    rating NUMERIC,
    review_count INTEGER,
    operating_hours JSONB,
    owner_whatsapp TEXT,
    check_count INTEGER,
    category_id TEXT,
    gm_category TEXT,
    buy_sell_category TEXT,
    buy_sell_category_id UUID,
    accepts_agent_inquiries BOOLEAN,
    agent_inquiry_phone TEXT,
    avg_response_time_minutes INTEGER,
    tags JSONB,
    leads_count INTEGER,
    lead_notifications_enabled BOOLEAN
);

-- Add indexes for common search columns
CREATE INDEX IF NOT EXISTS idx_businesses_category ON public.businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON public.businesses(city);
CREATE INDEX IF NOT EXISTS idx_businesses_country ON public.businesses(country);
CREATE INDEX IF NOT EXISTS idx_businesses_name ON public.businesses(name);
CREATE INDEX IF NOT EXISTS idx_businesses_lat_lng ON public.businesses(lat, lng);

-- Enable RLS (start with restrictive, allow public read if needed or just service role for now)
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Allow service_role to do everything (for import script and backend ops)
CREATE POLICY "Enable all for service_role" ON public.businesses
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow public read access (adjust as per requirements, assuming public directory)
CREATE POLICY "Enable read for public" ON public.businesses
    FOR SELECT
    TO public
    USING (true);
