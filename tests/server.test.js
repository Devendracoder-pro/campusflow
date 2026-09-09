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
    body: JSON.stringify({ displayName: 'Not Registered', mobileNumber: '9876543210', role: 'faculty' })
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.message, 'Registered user with this name and mobile number was not found.');
});

test('connected staff receive unique employee IDs', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const suffix = `${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const register = async (displayName, email, organizationName, mobileNumber) => fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationName, displayName, email, mobileNumber, password: 'supersecurepass123' })
  });
  const owner = await register('Owner User', `owner.${suffix}@example.com`, `ID College ${suffix}`, `900000${String(Date.now()).slice(-4)}`);
  assert.equal(owner.status, 201);
  const ownerCookie = owner.headers.get('set-cookie');
  const staffOneMobile = `910000${String(Date.now()).slice(-4)}`;
  const staffTwoMobile = `920000${String(Date.now()).slice(-4)}`;
  const staffOne = await register('Staff One', `staff.one.${suffix}@example.com`, `Other College One ${suffix}`, staffOneMobile);
  const staffTwo = await register('Staff Two', `staff.two.${suffix}@example.com`, `Other College Two ${suffix}`, staffTwoMobile);
  assert.equal(staffOne.status, 201);
  assert.equal(staffTwo.status, 201);
  const add = async (displayName, mobileNumber) => fetch(`http://127.0.0.1:${address.port}/api/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
    body: JSON.stringify({ displayName, mobileNumber, role: 'faculty' })
  });
  const first = await add('Staff One', staffOneMobile);
  const second = await add('Staff Two', staffTwoMobile);
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  const firstId = (await first.json()).employeeId;
  const secondId = (await second.json()).employeeId;
  assert.match(firstId, /^CF-[0-9A-F]{8}$/);
  assert.match(secondId, /^CF-[0-9A-F]{8}$/);
  assert.notEqual(firstId, secondId);
});

test('owner creates a mapped faculty account and faculty can mark only assigned-course attendance', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const suffix = `${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const request = (path, options = {}) => fetch(`http://127.0.0.1:${address.port}${path}`, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const register = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ organizationName: `Faculty College ${suffix}`, displayName: 'Faculty Owner', email: `owner.faculty.${suffix}@example.com`, password: 'supersecurepass123' }) });
  assert.equal(register.status, 201);
  const ownerCookie = register.headers.get('set-cookie');
  const course = await request('/api/courses', { method: 'POST', headers: { Cookie: ownerCookie }, body: JSON.stringify({ name: 'Algorithms', code: `CS${String(Date.now()).slice(-4)}`, department: 'Science', credits: 4, fee: 25000, feeCycle: 'Yearly' }) });
  assert.equal(course.status, 201);
  const courseRecord = await course.json();
  const student = await request('/api/students', { method: 'POST', headers: { Cookie: ownerCookie }, body: JSON.stringify({ name: 'Assigned Student', roll: `AS-${String(Date.now()).slice(-5)}`, email: `assigned.${suffix}@example.com`, courseId: courseRecord.id, year: 1, status: 'Active', joined: new Date().toISOString().slice(0, 10) }) });
  assert.equal(student.status, 201);
  const studentRecord = await student.json();
  const created = await request('/api/faculty/create', { method: 'POST', headers: { Cookie: ownerCookie }, body: JSON.stringify({ name: 'Faculty Member', email: `faculty.member.${suffix}@example.com`, mobileNumber: `930000${String(Date.now()).slice(-4)}`, department: 'Science', designation: 'Lecturer', courseMappings: [{ courseId: courseRecord.id, subjectName: 'Algorithms' }] }) });
  assert.equal(created.status, 201);
  const createdPayload = await created.json();
  assert.match(createdPayload.faculty.facultyId, /^CF-FAC-\d+$/);
  assert.ok(createdPayload.credentials.temporaryPassword);
  const facultyLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: createdPayload.credentials.email, password: createdPayload.credentials.temporaryPassword }) });
  assert.equal(facultyLogin.status, 200);
  const facultyCookie = facultyLogin.headers.get('set-cookie');
  const assigned = await request('/api/faculty/assigned', { headers: { Cookie: facultyCookie } });
  assert.equal(assigned.status, 200);
  const assignedPayload = await assigned.json();
  assert.equal(assignedPayload.courses.length, 1);
  assert.equal(assignedPayload.students[0].id, studentRecord.id);
  const facultyCreateAttempt = await request('/api/faculty/create', { method: 'POST', headers: { Cookie: facultyCookie }, body: JSON.stringify({ name: 'Blocked Faculty', email: `blocked.${suffix}@example.com`, mobileNumber: `940000${String(Date.now()).slice(-4)}`, department: 'Science', designation: 'Lecturer', courseMappings: [{ courseId: courseRecord.id, subjectName: 'Algorithms' }] }) });
  assert.equal(facultyCreateAttempt.status, 403);
  const marked = await request('/api/attendance/mark', { method: 'POST', headers: { Cookie: facultyCookie }, body: JSON.stringify({ courseId: courseRecord.id, date: new Date().toISOString().slice(0, 10), entries: [{ studentId: studentRecord.id, status: 'PRESENT' }] }) });
  assert.equal(marked.status, 200);
  const forbidden = await request('/api/attendance/mark', { method: 'POST', headers: { Cookie: facultyCookie }, body: JSON.stringify({ courseId: '00000000-0000-4000-8000-000000000000', date: new Date().toISOString().slice(0, 10), entries: [{ studentId: studentRecord.id, status: 'ABSENT' }] }) });
  assert.equal(forbidden.status, 403);
});
