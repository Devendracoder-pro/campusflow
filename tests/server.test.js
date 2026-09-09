const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server.js');
const db = require('../db.js');

test('server exposes a health endpoint and security headers', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('server exposes truthful database readiness', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', database: await db.health() });
});

test('current-user endpoint requires authentication', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/me`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
});

test('resource API rejects unauthenticated access', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/students`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
});

test('server rejects unsupported methods', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/`, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
});

test('health endpoints reject unsupported methods', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
});

test('principal can fetch audit log entries after a secure login', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const uniqueEmail = `principal.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
  const register = await fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationName: `Audit College ${Date.now()}`, displayName: 'Principal User', email: uniqueEmail, password: 'supersecurepass123' })
  });
  assert.equal(register.status, 201);
  const authCookie = register.headers.get('set-cookie');
  const audit = await fetch(`http://127.0.0.1:${address.port}/api/audit`, { headers: { Cookie: authCookie } });
  assert.equal(audit.status, 200);
  const payload = await audit.json();
  assert.ok(Array.isArray(payload.data));
});

test('principal receives a summary dashboard with core operational metrics', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const uniqueEmail = `principal.dashboard.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
  const register = await fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationName: `Dashboard College ${Date.now()}`, displayName: 'Principal User', email: uniqueEmail, password: 'supersecurepass123' })
  });
  assert.equal(register.status, 201);
  const authCookie = register.headers.get('set-cookie');
  const dashboard = await fetch(`http://127.0.0.1:${address.port}/api/dashboard`, { headers: { Cookie: authCookie } });
  assert.equal(dashboard.status, 200);
  const payload = await dashboard.json();
  assert.ok(typeof payload.summary === 'object');
  assert.ok(payload.summary.studentCount >= 0);
  assert.ok(payload.summary.feeCollected >= 0);
});

test('principal can fetch onboarding readiness for the college workspace', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const uniqueEmail = `principal.onboarding.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
  const register = await fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationName: `Onboarding College ${Date.now()}`, displayName: 'Principal User', email: uniqueEmail, password: 'supersecurepass123' })
  });
  assert.equal(register.status, 201);
  const authCookie = register.headers.get('set-cookie');
  const onboarding = await fetch(`http://127.0.0.1:${address.port}/api/onboarding`, { headers: { Cookie: authCookie } });
  assert.equal(onboarding.status, 200);
  const payload = await onboarding.json();
  assert.ok(typeof payload.workspace === 'object');
  assert.ok(Array.isArray(payload.steps));
  assert.ok(typeof payload.ready === 'boolean');
});

test('staff can only be added after the user has registered', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const uniqueEmail = `principal.staffcheck.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
  const register = await fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationName: `Staff Check College ${Date.now()}`, displayName: 'Principal Login', email: uniqueEmail, password: 'supersecurepass123' })
  });
  assert.equal(register.status, 201);
  const authCookie = register.headers.get('set-cookie');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: JSON.stringify({ email: 'notregistered.user@example.com', role: 'faculty' })
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.message, 'User must register before being added to staff.');
});
