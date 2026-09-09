require('dotenv').config({ quiet: true });
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Create a .env file from .env.example, set your PostgreSQL URL, then run npm run migrate.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX) || 10 });
  const client = await pool.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const directory = path.join(__dirname, 'migrations');
    const files = (await fs.readdir(directory)).filter(file => file.endsWith('.sql')).sort();
    for (const filename of files) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
      if (applied.rowCount) continue;
      await client.query('BEGIN');
      try {
        await client.query(await fs.readFile(path.join(directory, filename), 'utf8'));
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`Applied ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) migrate().then(() => console.log('Database migrations complete.')).catch(error => { console.error(`Migration failed: ${error.message}`); process.exitCode = 1; });
module.exports = { migrate };
