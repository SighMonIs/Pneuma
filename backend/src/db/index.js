import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pneuma',
  user: process.env.DB_USER || 'pneuma',
  password: process.env.DB_PASSWORD || 'pneuma',
});

export async function initDb() {
  const maxRetries = 10;
  const retryDelay = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let client;
    try {
      client = await pool.connect();
      console.log(`[DB] Connected to PostgreSQL (attempt ${attempt})`);
    } catch (err) {
      console.error(`[DB] Connection attempt ${attempt}/${maxRetries} failed:`, err.message);
      if (attempt === maxRetries) throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      continue;
    }

    try {
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      const statements = schema.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        await client.query(stmt);
      }
      console.log('[DB] Schema initialized');
      return;
    } catch (err) {
      console.error('[DB] Schema error (not retrying):', err.message);
      throw err;
    } finally {
      client.release();
    }
  }
}
