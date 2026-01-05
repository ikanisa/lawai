
import fs from 'node:fs';
import readline from 'node:readline';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';

// Load environment variables from correct location
const envPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: envPath });

const DATABASE_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL or SUPABASE_DB_URL is not set in environment variables');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
});

const CSV_FILE_PATH = '/Users/jeanbosco/Downloads/businesses_rows.csv';

// Interface matching the table schema
interface Business {
    id: string;
    profile_id?: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
    external_id?: string;
    category?: string;
    city?: string;
    address?: string;
    country?: string;
    lat?: number;
    lng?: number;
    phone?: string;
    website?: string;
    email?: string;
    status?: string;
    rating?: number;
    review_count?: number; // integer
    operating_hours?: any;
    owner_whatsapp?: string;
    check_count?: number;
    category_id?: string;
    gm_category?: string;
    buy_sell_category?: string;
    buy_sell_category_id?: string; // uuid
    accepts_agent_inquiries?: boolean;
    agent_inquiry_phone?: string;
    avg_response_time_minutes?: number;
    tags?: any;
    leads_count?: number;
    lead_notifications_enabled?: boolean;
}

// Simple CSV parser that handles quoted fields
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let currentToken = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    // Escaped quote
                    currentToken += '"';
                    i++;
                } else {
                    // End of quote
                    inQuotes = false;
                }
            } else {
                currentToken += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                result.push(currentToken);
                currentToken = '';
            } else {
                currentToken += char;
            }
        }
    }
    result.push(currentToken);
    return result;
}

function cleanString(val: string): string | null {
    if (!val || val.trim() === '') return null;
    return val.trim();
}

function parseBool(val: string): boolean | null {
    const s = cleanString(val);
    if (s === null) return null;
    return s.toLowerCase() === 'true' || s === '1';
}

function parseNumber(val: string): number | null {
    const s = cleanString(val);
    if (s === null) return null;
    const n = Number(s);
    return isNaN(n) ? null : n;
}

function parseJSON(val: string): any {
    const s = cleanString(val);
    if (s === null) return null;
    try {
        return JSON.parse(s);
    } catch (e) {
        // try removing extra quotes if double quoted
        try {
            if (s.startsWith('"') && s.endsWith('"')) {
                return JSON.parse(s.slice(1, -1).replace(/""/g, '"'));
            }
        } catch (e2) { }
        console.warn(`Failed to parse JSON: ${s}`);
        return null;
    }
}

async function importBusinesses() {
    console.log(`Connecting to DB: ${DATABASE_URL?.split('@')[1]}`); // Mask credentials
    const client = await pool.connect();

    try {
        const fileStream = fs.createReadStream(CSV_FILE_PATH);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });

        let headers: string[] = [];
        let isFirstLine = true;
        let successCount = 0;
        let errorCount = 0;
        let batch: any[] = [];
        const BATCH_SIZE = 100;

        for await (const line of rl) {
            if (!line.trim()) continue;

            const cols = parseCSVLine(line);

            if (isFirstLine) {
                headers = cols.map(h => h.trim());
                console.log('Headers:', headers);
                isFirstLine = false;
                continue;
            }

            const row: any = {};
            // Mapping based on index
            // id,profile_id,name,description,created_at,updated_at,external_id,category,city,address,country,lat,lng,phone,website,email,status,rating,review_count,operating_hours,owner_whatsapp,check_count,category_id,gm_category,buy_sell_category,buy_sell_category_id,accepts_agent_inquiries,agent_inquiry_phone,avg_response_time_minutes,tags,leads_count,lead_notifications_enabled

            // We need to map CSV columns to DB columns safely
            // Assuming headers are consistent with my plan, but let's be safe and use header index

            const getValue = (colName: string): string => {
                const idx = headers.indexOf(colName);
                if (idx === -1) return '';
                return cols[idx] || '';
            };

            try {
                row.id = getValue('id');
                if (!row.id) {
                    console.warn(`Skipping row with missing ID: ${line.substring(0, 50)}...`);
                    continue;
                }

                row.profile_id = cleanString(getValue('profile_id')); // uuid
                row.name = getValue('name');
                row.description = cleanString(getValue('description'));
                row.created_at = getValue('created_at') || new Date().toISOString();
                row.updated_at = getValue('updated_at') || new Date().toISOString();
                row.external_id = cleanString(getValue('external_id'));
                row.category = cleanString(getValue('category'));
                row.city = cleanString(getValue('city'));
                row.address = cleanString(getValue('address'));
                row.country = cleanString(getValue('country'));
                row.lat = parseNumber(getValue('lat'));
                row.lng = parseNumber(getValue('lng'));
                row.phone = cleanString(getValue('phone'));
                row.website = cleanString(getValue('website'));
                row.email = cleanString(getValue('email'));
                row.status = cleanString(getValue('status'));
                row.rating = parseNumber(getValue('rating'));
                row.review_count = parseNumber(getValue('review_count'));
                row.operating_hours = parseJSON(getValue('operating_hours'));
                row.owner_whatsapp = cleanString(getValue('owner_whatsapp'));
                row.check_count = parseNumber(getValue('check_count'));
                row.category_id = cleanString(getValue('category_id'));
                row.gm_category = cleanString(getValue('gm_category'));
                row.buy_sell_category = cleanString(getValue('buy_sell_category'));
                row.buy_sell_category_id = cleanString(getValue('buy_sell_category_id')); // uuid from CSV
                row.accepts_agent_inquiries = parseBool(getValue('accepts_agent_inquiries'));
                row.agent_inquiry_phone = cleanString(getValue('agent_inquiry_phone'));
                row.avg_response_time_minutes = parseNumber(getValue('avg_response_time_minutes'));
                row.tags = parseJSON(getValue('tags'));
                row.leads_count = parseNumber(getValue('leads_count'));
                row.lead_notifications_enabled = parseBool(getValue('lead_notifications_enabled'));

                batch.push(row);

                if (batch.length >= BATCH_SIZE) {
                    await insertBatch(client, batch);
                    successCount += batch.length;
                    console.log(`Processed ${successCount} rows...`);
                    batch = [];
                }

            } catch (err) {
                console.error(`Error processing row ID ${cols[0]}:`, err);
                errorCount++;
            }
        }

        if (batch.length > 0) {
            await insertBatch(client, batch);
            successCount += batch.length;
        }

        console.log(`Import completed. Success: ${successCount}, Errors: ${errorCount}`);

    } catch (e) {
        console.error('Fatal error during import:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

async function insertBatch(client: any, rows: any[]) {
    // Construct bulk insert using specific columns to match schema
    // We can use simple loop or JSON patching, but parameterized query is best for PG
    // However, given different dynamic structure, a specialized query builder or key matching is needed.
    // For simplicity, we'll try to insert one by one or create a big VALUES query.
    // Since columns are static (we defined schema), we can build one query.

    if (rows.length === 0) return;

    const columns = [
        'id', 'profile_id', 'name', 'description', 'created_at', 'updated_at',
        'external_id', 'category', 'city', 'address', 'country', 'lat', 'lng',
        'phone', 'website', 'email', 'status', 'rating', 'review_count',
        'operating_hours', 'owner_whatsapp', 'check_count', 'category_id',
        'gm_category', 'buy_sell_category', 'buy_sell_category_id',
        'accepts_agent_inquiries', 'agent_inquiry_phone',
        'avg_response_time_minutes', 'tags', 'leads_count', 'lead_notifications_enabled'
    ];

    // Generate ($1, $2...), ($3, $4...)...
    const values: any[] = [];
    const placeholders: string[] = [];

    rows.forEach((row, rowIndex) => {
        const rowPlaceholders: string[] = [];
        columns.forEach((col, colIndex) => {
            const paramIndex = rowIndex * columns.length + colIndex + 1;
            rowPlaceholders.push(`$${paramIndex}`);
            values.push(row[col] === undefined ? null : row[col]);
        });
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
    });

    const query = `
        INSERT INTO businesses (${columns.join(', ')})
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (id) DO UPDATE SET
            updated_at = EXCLUDED.updated_at,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            city = EXCLUDED.city,
            address = EXCLUDED.address,
            phone = EXCLUDED.phone,
            tags = EXCLUDED.tags,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng;
    `;

    try {
        await client.query(query, values);
    } catch (e) {
        console.error('Error inserting batch:', e);
        // Fallback: try one by one to find the bad apple if needed, or just throw
        throw e;
    }
}

importBusinesses().catch(console.error);
