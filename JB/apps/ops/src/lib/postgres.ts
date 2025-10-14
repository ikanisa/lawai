import { Client } from 'pg';

export async function listMissingExtensions(
  connectionString: string,
  requiredExtensions: readonly string[],
): Promise<string[]> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const result = await client.query<{ extname: string }>(
      'select extname from pg_extension where extname = any($1)',
      [requiredExtensions],
    );
    const present = new Set(result.rows.map((row) => row.extname));
    return requiredExtensions.filter((ext) => !present.has(ext));
  } finally {
    await client.end();
  }
}
