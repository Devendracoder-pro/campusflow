const crypto = require('node:crypto');
const db = require('./db');

const SESSION_COOKIE = 'campusflow_session';
const SESSION_DAYS = 7;
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};
function verifyPassword(password, stored) {
  const [salt, expected] = String(stored).split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
function validCredentials(input) {
  if (!input || typeof input.organizationName !== 'string' || input.organizationName.trim().length < 2 || input.organizationName.length > 160) throw new Error('Organization name is required.');
  if (!input || typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Enter a valid email address.');
  if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 200) throw new Error('Password must be between 12 and 200 characters.');
  if (typeof input.displayName !== 'string' || input.displayName.trim().length < 2 || input.displayName.length > 160) throw new Error('Display name is required.');
  if (input.mobileNumber !== undefined && input.mobileNumber !== '' && !/^\+?[0-9\s()-]{10,20}$/.test(input.mobileNumber)) throw new Error('Enter a valid mobile number.');
}
function cookieHeader(token, expires) { return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor((expires - Date.now()) / 1000)}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`; }
function clearCookie() { return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`; }
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
async function register(input) {
  validCredentials(input);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const organization = await client.query('INSERT INTO organizations (name) VALUES ($1) RETURNING id, name', [input.organizationName?.trim()]);
    const user = await client.query('INSERT INTO users (email, password_hash, display_name, mobile_number) VALUES (lower($1), $2, $3, $4) RETURNING id, email, display_name', [input.email.trim(), hashPassword(input.password), input.displayName.trim(), input.mobileNumber?.trim() || null]);
    await client.query('INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, $3)', [organization.rows[0].id, user.rows[0].id, 'owner']);
    await client.query('COMMIT');
    return { user: user.rows[0], organization: organization.rows[0], role: 'owner' };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
async function login(email, password) {
  const result = await db.query('SELECT u.id, u.email, u.display_name, u.employee_id, u.password_hash, m.organization_id, o.name AS organization_name, m.role FROM users u JOIN memberships m ON m.user_id = u.id JOIN organizations o ON o.id = m.organization_id WHERE lower(u.email) = lower($1) LIMIT 1', [email]);
  if (!result.rowCount || !verifyPassword(password, result.rows[0].password_hash)) throw new Error('Invalid email or password.');
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await db.query('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, to_timestamp($3 / 1000.0))', [result.rows[0].id, tokenHash(token), expires]);
  const { password_hash, ...user } = result.rows[0];
  return { token, expires, user };
}
function parseCookies(header = '') { return Object.fromEntries(header.split(';').map(item => item.trim().split('=').map(decodeURIComponent)).filter(pair => pair.length === 2)); }
async function currentUser(cookieHeaderValue) {
  const token = parseCookies(cookieHeaderValue)[SESSION_COOKIE];
  if (!token) return null;
  const result = await db.query('SELECT u.id, u.email, u.display_name, u.employee_id, m.organization_id, o.name AS organization_name, m.role FROM sessions s JOIN users u ON u.id = s.user_id JOIN memberships m ON m.user_id = u.id JOIN organizations o ON o.id = m.organization_id WHERE s.token_hash = $1 AND s.expires_at > now() LIMIT 1', [tokenHash(token)]);
  return result.rows[0] || null;
}
async function logout(cookieHeaderValue) {
  const token = parseCookies(cookieHeaderValue)[SESSION_COOKIE];
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
}
module.exports = { SESSION_COOKIE, cookieHeader, clearCookie, register, login, currentUser, logout };
