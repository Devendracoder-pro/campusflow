require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

const configured = Boolean(process.env.DATABASE_URL);
const pool = configured ? new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX) || 10, idleTimeoutMillis: 1000, connectionTimeoutMillis: 5000, allowExitOnIdle: true }) : null;

async function health() {
  if (!pool) return { configured: false, connected: false };
  try {
    await pool.query('SELECT 1');
    return { configured: true, connected: true };
  } catch {
    return { configured: true, connected: false };
  }
}

async function query(text, values) {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  return pool.query(text, values);
}

async function close() {
  if (pool) await pool.end();
}

module.exports = { configured, pool, health, query, close };
