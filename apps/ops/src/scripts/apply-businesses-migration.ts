
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: envPath });

const DATABASE_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
});

const sql = `
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

CREATE INDEX IF NOT EXISTS idx_businesses_category ON public.businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON public.businesses(city);
CREATE INDEX IF NOT EXISTS idx_businesses_country ON public.businesses(country);
CREATE INDEX IF NOT EXISTS idx_businesses_name ON public.businesses(name);
CREATE INDEX IF NOT EXISTS idx_businesses_lat_lng ON public.businesses(lat, lng);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for service_role' AND tablename = 'businesses'
    ) THEN
        CREATE POLICY "Enable all for service_role" ON public.businesses
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Enable read for public' AND tablename = 'businesses'
    ) THEN
        CREATE POLICY "Enable read for public" ON public.businesses
            FOR SELECT
            TO public
            USING (true);
    END IF;
END
$$;
`;

async function run() {
    const client = await pool.connect();
    try {
        console.log('Applying migration...');
        await client.query(sql);
        console.log('Migration applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
