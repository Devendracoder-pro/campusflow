const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const auth = require('./auth');
const { handleApi, handleAttendance, handleAttendanceMark, handleFacultyAccounts, handlePayments, handleStaff, handleAudit, handleDashboard, handleOnboarding } = require('./api');

const root = __dirname;
const builtRoot = path.join(root, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.pdf': 'application/pdf', '.svg': 'image/svg+xml' };
const securityHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};
function json(res, status, body, headers = {}) { res.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(body)); }
async function body(req) {
  let raw = ''; for await (const chunk of req) raw += chunk;
  if (raw.length > 1024 * 1024) throw new Error('Request body is too large.');
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error('Request body must be valid JSON.'); }
}
function createServer() {
  return http.createServer((req, res) => {
    if (req.url === '/api/faculty/create' || req.url === '/api/faculty/assigned') { handleFacultyAccounts(req, res).catch(() => json(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Unable to manage faculty accounts.' } })); return; }
    if (req.url === '/api/attendance/mark') { handleAttendanceMark(req, res).catch(() => json(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Unable to mark attendance.' } })); return; }
    if (req.url.startsWith('/api/students') || req.url.startsWith('/api/faculty') || req.url.startsWith('/api/courses')) {
      handleApi(req, res).catch(() => json(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Unable to complete the request.' } }));
      return;
    }
    if (req.url.startsWith('/api/attendance')) { handleAttendance(req, res).catch(() => json(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Unable to complete the request.' } })); return; }
    if (req.url.startsWith('/api/payments')) { handlePayments(req, res).catch(() => json(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Unable to complete the request.' } })); return; }
    if (req.url.startsWith('/api/staff')) { handleStaff(req, res).catch(() => json(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Unable to complete the request.' } })); return; }
    if (req.url === '/api/audit') { handleAudit(req, res).catch(() => json(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Unable to load audit logs.' } })); return; }
    if (req.url === '/api/dashboard') { handleDashboard(req, res).catch(() => json(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Unable to load dashboard summary.' } })); return; }
    if (req.url === '/api/onboarding') { handleOnboarding(req, res).catch(() => json(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Unable to load onboarding status.' } })); return; }
    if (req.url === '/api/auth/register' && req.method === 'POST') {
      body(req).then(async input => { const result = await auth.register(input); const session = await auth.login(input.email, input.password); return json(res, 201, { user: session.user, organization: result.organization, role: result.role }, { 'Set-Cookie': auth.cookieHeader(session.token, session.expires) }); }).catch(error => json(res, error.code === '23505' ? 409 : 400, { error: { code: error.code === '23505' ? 'CONFLICT' : 'VALIDATION_ERROR', message: error.message } }));
      return;
    }
    if (req.url === '/api/auth/login' && req.method === 'POST') {
      body(req).then(input => auth.login(input.email, input.password)).then(result => json(res, 200, { user: result.user }, { 'Set-Cookie': auth.cookieHeader(result.token, result.expires) })).catch(() => json(res, 401, { error: { code: 'AUTHENTICATION_FAILED', message: 'Invalid email or password.' } }));
      return;
    }
    if (req.url === '/api/auth/logout' && req.method === 'POST') {
      auth.logout(req.headers.cookie).then(() => json(res, 200, { ok: true }, { 'Set-Cookie': auth.clearCookie() })).catch(() => json(res, 200, { ok: true }, { 'Set-Cookie': auth.clearCookie() }));
      return;
    }
    if (req.url === '/api/me' && req.method === 'GET') {
      auth.currentUser(req.headers.cookie).then(user => user ? json(res, 200, { user }) : json(res, 401, { error: { code: 'UNAUTHENTICATED', message: 'Login required.' } })).catch(() => json(res, 503, { error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable.' } }));
      return;
    }
    if (req.url === '/api/health' || req.url === '/api/healthz') {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { ...securityHeaders, Allow: 'GET, HEAD' }).end('Method not allowed'); return; }
      db.health().then(status => {
        const healthy = !status.configured || status.connected;
        res.writeHead(healthy ? 200 : 503, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8' });
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: healthy ? 'ok' : 'degraded', database: status }));
      }).catch(() => {
        res.writeHead(503, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'degraded', database: { configured: true, connected: false } }));
      });
      return;
    }
    if (req.url === '/health' || req.url === '/healthz') {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { ...securityHeaders, Allow: 'GET, HEAD' }).end('Method not allowed'); return; }
      res.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok' }));
      return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end('Bad request'); return; }
    const relativePath = pathname === '/' ? '/index.html' : pathname;
    const builtFile = path.resolve(builtRoot, '.' + relativePath);
    const sourceFile = path.resolve(root, '.' + relativePath);
    const file = fs.existsSync(builtFile) ? builtFile : sourceFile;
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { ...securityHeaders, Allow: 'GET, HEAD' }).end('Method not allowed'); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500, securityHeaders).end(error.code === 'ENOENT' ? 'Not found' : 'Internal server error'); return; }
      res.writeHead(200, { ...securityHeaders, 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}
if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  createServer().listen(port, host, () => console.log(`CampusFlow is running on ${host}:${port}`));
}
module.exports = { createServer };