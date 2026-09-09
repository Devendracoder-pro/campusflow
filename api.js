const { randomUUID } = require('node:crypto');
const db = require('./db');
const auth = require('./auth');

const roles = {
  owner: new Set(['read', 'manage', 'staff']),
  principal: new Set(['read', 'manage', 'staff']),
  administrator: new Set(['read', 'manage']),
  faculty: new Set(['read']),
  accountant: new Set(['read']),
  read_only: new Set(['read'])
};
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(res, status, payload) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); }
function fail(res, status, code, message) { return json(res, status, { error: { code, message, requestId: randomUUID() } }); }
async function writeAuditLog(user, action, entityType, entityId, metadata = {}) {
  if (!user || !user.organization_id) return;
  try {
    await db.query('INSERT INTO audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)', [user.organization_id, user.id, action, entityType, entityId || null, metadata]);
  } catch {
    // Audit logging should never block the main action; keep the production flow resilient.
  }
}
async function readBody(req) {
  let raw = ''; for await (const chunk of req) raw += chunk;
  if (raw.length > 1024 * 1024) throw new Error('Request body is too large.');
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error('Request body must be valid JSON.'); }
}
async function session(req, res, action) {
  const user = await auth.currentUser(req.headers.cookie);
  if (!user) { fail(res, 401, 'UNAUTHENTICATED', 'Login required.'); return null; }
  if (!roles[user.role]?.has(action)) { fail(res, 403, 'FORBIDDEN', 'You do not have permission for this action.'); return null; }
  return user;
}
function text(value, label, max = 160) { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} is required.`); return value.trim(); }
function recordInput(type, input) {
  if (type === 'courses') return { name: text(input.name, 'Course name'), code: text(input.code, 'Course code', 20).toUpperCase(), department: text(input.department, 'Department'), credits: Number(input.credits), facultyId: input.facultyId || null, fee: Number(input.fee), feeCycle: input.feeCycle === 'Semester' ? 'Semester' : input.feeCycle === 'Yearly' ? 'Yearly' : (() => { throw new Error('Fee cycle is required.') })() };
  if (type === 'faculty') return { name: text(input.name, 'Faculty name'), email: text(input.email, 'Email', 320).toLowerCase(), department: text(input.department, 'Department'), designation: text(input.designation, 'Designation', 80) };
  return { name: text(input.name, 'Student name'), roll: text(input.roll, 'Roll number', 30).toUpperCase(), email: text(input.email, 'Email', 320).toLowerCase(), courseId: text(input.courseId, 'Course'), year: Number(input.year), status: text(input.status, 'Status'), joined: text(input.joined, 'Enrollment date', 10) };
}
const tableConfig = {
  students: { table: 'students', columns: 'id, name, roll, email, course_id AS "courseId", year, status, joined', order: 'name' },
  faculty: { table: 'faculty', columns: 'id, name, email, department, designation', order: 'name' },
  courses: { table: 'courses', columns: 'id, name, code, department, credits, faculty_id AS "facultyId", fee, fee_cycle AS "feeCycle"', order: 'name' }
};
async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const match = url.pathname.match(/^\/api\/(students|faculty|courses)(?:\/([^/]+))?$/);
  if (!match) return false;
  const type = match[1]; const id = match[2]; const config = tableConfig[type];
  if (id && !idPattern.test(id)) return fail(res, 404, 'NOT_FOUND', 'Record not found.');
  const action = req.method === 'GET' ? 'read' : 'manage';
  let user;
  try { user = await session(req, res, action); if (!user) return true; } catch { return fail(res, 503, 'DATABASE_UNAVAILABLE', 'Database unavailable.'); }
  try {
    if (req.method === 'GET') {
      const result = id ? await db.query(`SELECT ${config.columns} FROM ${config.table} WHERE organization_id = $1 AND id = $2`, [user.organization_id, id]) : await db.query(`SELECT ${config.columns} FROM ${config.table} WHERE organization_id = $1 ORDER BY ${config.order}`, [user.organization_id]);
      return json(res, 200, id ? (result.rows[0] || null) : { data: result.rows });
    }
    if (req.method === 'POST') {
      const input = recordInput(type, await readBody(req));
      const values = type === 'students' ? [user.organization_id, input.name, input.roll, input.email, input.courseId, input.year, input.status, input.joined] : type === 'faculty' ? [user.organization_id, input.name, input.email, input.department, input.designation] : [user.organization_id, input.name, input.code, input.department, input.credits, input.facultyId, input.fee, input.feeCycle];
      const sql = type === 'students' ? `INSERT INTO students (organization_id,name,roll,email,course_id,year,status,joined) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${config.columns}` : type === 'faculty' ? `INSERT INTO faculty (organization_id,name,email,department,designation) VALUES ($1,$2,$3,$4,$5) RETURNING ${config.columns}` : `INSERT INTO courses (organization_id,name,code,department,credits,faculty_id,fee,fee_cycle) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${config.columns}`;
      const result = await db.query(sql, values);
      await writeAuditLog(user, 'create', type, result.rows[0].id, { name: result.rows[0].name || input.name });
      return json(res, 201, result.rows[0]);
    }
    if (req.method === 'PATCH' && id) {
      const input = recordInput(type, await readBody(req));
      const values = type === 'students' ? [input.name, input.roll, input.email, input.courseId, input.year, input.status, input.joined, user.organization_id, id] : type === 'faculty' ? [input.name, input.email, input.department, input.designation, user.organization_id, id] : [input.name, input.code, input.department, input.credits, input.facultyId, input.fee, input.feeCycle, user.organization_id, id];
      const sql = type === 'students' ? `UPDATE students SET name=$1,roll=$2,email=$3,course_id=$4,year=$5,status=$6,joined=$7 WHERE organization_id=$8 AND id=$9 RETURNING ${config.columns}` : type === 'faculty' ? `UPDATE faculty SET name=$1,email=$2,department=$3,designation=$4 WHERE organization_id=$5 AND id=$6 RETURNING ${config.columns}` : `UPDATE courses SET name=$1,code=$2,department=$3,credits=$4,faculty_id=$5,fee=$6,fee_cycle=$7 WHERE organization_id=$8 AND id=$9 RETURNING ${config.columns}`;
      const result = await db.query(sql, values);
      if (!result.rowCount) return fail(res, 404, 'NOT_FOUND', 'Record not found.');
      await writeAuditLog(user, 'update', type, id, { name: result.rows[0].name || input.name });
      return json(res, 200, result.rows[0]);
    }
    if (req.method === 'DELETE' && id) {
      const result = await db.query(`DELETE FROM ${config.table} WHERE organization_id = $1 AND id = $2 RETURNING id`, [user.organization_id, id]);
      if (!result.rowCount) return fail(res, 404, 'NOT_FOUND', 'Record not found.');
      await writeAuditLog(user, 'delete', type, id, { deleted: true });
      return json(res, 200, { ok: true });
    }
    return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'CONFLICT', 'A record with this unique value already exists.');
    if (error.code === '23503' || error.code === '23514' || error.message.endsWith('is required.')) return fail(res, 400, 'VALIDATION_ERROR', error.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Unable to complete the request.');
  }
}
async function handleAttendance(req, res) {
  const url = new URL(req.url, 'http://localhost'); const match = url.pathname.match(/^\/api\/attendance(?:\/([^/]+))?$/); if (!match) return false;
  const user = await session(req, res, req.method === 'GET' ? 'read' : 'manage'); if (!user) return true;
  try {
    if (req.method === 'GET') { const result = await db.query('SELECT student_id AS "studentId", attended_on AS date, status FROM attendance WHERE organization_id=$1 AND ($2::date IS NULL OR attended_on=$2::date) ORDER BY attended_on DESC', [user.organization_id, url.searchParams.get('date') || null]); return json(res, 200, { data: result.rows }); }
    if (req.method !== 'PUT' || !match[1]) return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    const entries = await readBody(req); if (!Array.isArray(entries) || !entries.length) return fail(res, 400, 'VALIDATION_ERROR', 'Attendance entries are required.');
    const client = await db.pool.connect(); try { await client.query('BEGIN'); for (const entry of entries) { if (!['Present', 'Absent', 'Late', 'Unmarked'].includes(entry.status)) throw new Error('Invalid attendance status.'); if (entry.status === 'Unmarked') await client.query('DELETE FROM attendance WHERE organization_id=$1 AND student_id=$2 AND attended_on=$3', [user.organization_id, entry.studentId, match[1]]); else await client.query('INSERT INTO attendance (organization_id,student_id,attended_on,status) VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id,student_id,attended_on) DO UPDATE SET status=EXCLUDED.status', [user.organization_id, entry.studentId, match[1], entry.status]); } await client.query('COMMIT'); return json(res, 200, { ok: true }); } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  } catch (error) { return fail(res, error.code === '23503' ? 400 : 500, error.code === '23503' ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR', error.code === '23503' ? 'Invalid attendance student.' : 'Unable to save attendance.'); }
}
async function handlePayments(req, res) {
  if (new URL(req.url, 'http://localhost').pathname !== '/api/payments') return false;
  const user = await session(req, res, req.method === 'GET' ? 'read' : 'manage'); if (!user) return true;
  try {
    if (req.method === 'GET') { const result = await db.query('SELECT id,student_id AS "studentId",amount,paid_on AS date,method FROM payments WHERE organization_id=$1 ORDER BY paid_on DESC', [user.organization_id]); return json(res, 200, { data: result.rows }); }
    if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    const key = req.headers['idempotency-key']; if (!key || key.length > 200) return fail(res, 400, 'VALIDATION_ERROR', 'Idempotency-Key header is required.');
    const input = await readBody(req); const result = await db.query('INSERT INTO payments (organization_id,student_id,amount,paid_on,method,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (organization_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id,student_id AS "studentId",amount,paid_on AS date,method', [user.organization_id, input.studentId, Number(input.amount), input.date, input.method, key]);
    await writeAuditLog(user, 'payment', 'payments', result.rows[0].id, { studentId: input.studentId, amount: Number(input.amount) });
    return json(res, 201, result.rows[0]);
  } catch (error) { return fail(res, error.code === '23503' || error.code === '23514' ? 400 : 500, 'VALIDATION_ERROR', 'Invalid payment details.'); }
}

async function handleAudit(req, res) {
  const url = new URL(req.url, 'http://localhost'); if (url.pathname !== '/api/audit') return false;
  const user = await session(req, res, req.method === 'GET' ? 'read' : 'staff');
  if (!user) return true;
  if (!['owner', 'principal'].includes(user.role)) return fail(res, 403, 'FORBIDDEN', 'Only principal and owner roles can view the audit trail.');
  if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  try {
    const result = await db.query('SELECT a.id, a.action, a.entity_type AS "entityType", a.entity_id AS "entityId", a.metadata, a.created_at AS "createdAt", u.display_name AS "actorName" FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id WHERE a.organization_id = $1 ORDER BY a.created_at DESC LIMIT 100', [user.organization_id]);
    return json(res, 200, { data: result.rows });
  } catch (error) {
    return fail(res, 500, 'INTERNAL_ERROR', 'Unable to load audit logs.');
  }
}

async function handleDashboard(req, res) {
  const url = new URL(req.url, 'http://localhost'); if (url.pathname !== '/api/dashboard') return false;
  const user = await session(req, res, req.method === 'GET' ? 'read' : 'staff');
  if (!user) return true;
  if (!['owner', 'principal'].includes(user.role)) return fail(res, 403, 'FORBIDDEN', 'Only principal and owner roles can view the dashboard.');
  if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  try {
    const studentCount = await db.query('SELECT COUNT(*)::int AS count FROM students WHERE organization_id = $1', [user.organization_id]);
    const activeStudents = await db.query('SELECT COUNT(*)::int AS count FROM students WHERE organization_id = $1 AND status = $2', [user.organization_id, 'Active']);
    const feeCollected = await db.query('SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM payments WHERE organization_id = $1', [user.organization_id]);
    const presentToday = await db.query('SELECT COUNT(*)::int AS count FROM attendance WHERE organization_id = $1 AND attended_on = CURRENT_DATE AND status = $2', [user.organization_id, 'Present']);
    const summary = {
      studentCount: Number(studentCount.rows[0].count || 0),
      activeStudents: Number(activeStudents.rows[0].count || 0),
      feeCollected: Number(feeCollected.rows[0].total || 0),
      presentToday: Number(presentToday.rows[0].count || 0),
      outstanding: 0
    };
    return json(res, 200, { summary, organization: { name: user.organization_name } });
  } catch (error) {
    return fail(res, 500, 'INTERNAL_ERROR', 'Unable to load dashboard summary.');
  }
}

async function handleOnboarding(req, res) {
  const url = new URL(req.url, 'http://localhost'); if (url.pathname !== '/api/onboarding') return false;
  const user = await session(req, res, req.method === 'GET' ? 'read' : 'staff');
  if (!user) return true;
  if (!['owner', 'principal'].includes(user.role)) return fail(res, 403, 'FORBIDDEN', 'Only principal and owner roles can view onboarding status.');
  if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  try {
    const org = await db.query('SELECT o.id, o.name FROM organizations o WHERE o.id = $1', [user.organization_id]);
    const staff = await db.query('SELECT COUNT(*)::int AS count FROM memberships WHERE organization_id = $1', [user.organization_id]);
    const students = await db.query('SELECT COUNT(*)::int AS count FROM students WHERE organization_id = $1', [user.organization_id]);
    const courses = await db.query('SELECT COUNT(*)::int AS count FROM courses WHERE organization_id = $1', [user.organization_id]);
    const faculty = await db.query('SELECT COUNT(*)::int AS count FROM faculty WHERE organization_id = $1', [user.organization_id]);
    const workspace = {
      id: org.rows[0]?.id || user.organization_id,
      name: org.rows[0]?.name || user.organization_name,
      staffCount: Number(staff.rows[0].count || 0),
      studentCount: Number(students.rows[0].count || 0),
      courseCount: Number(courses.rows[0].count || 0),
      facultyCount: Number(faculty.rows[0].count || 0)
    };
    const steps = [
      { key: 'workspace', label: 'Create workspace', done: true },
      { key: 'owner', label: 'Assign owner access', done: user.role === 'owner' || user.role === 'principal' },
      { key: 'staff', label: 'Invite staff', done: workspace.staffCount > 1 },
      { key: 'faculty', label: 'Add faculty', done: workspace.facultyCount > 0 },
      { key: 'courses', label: 'Create courses', done: workspace.courseCount > 0 },
      { key: 'students', label: 'Import students', done: workspace.studentCount > 0 }
    ];
    const ready = workspace.staffCount > 0 && workspace.courseCount > 0 && workspace.studentCount > 0;
    return json(res, 200, { workspace, steps, ready });
  } catch (error) {
    return fail(res, 500, 'INTERNAL_ERROR', 'Unable to load onboarding status.');
  }
}
module.exports = { handleApi, handleAttendance, handlePayments, handleAudit, handleDashboard, handleOnboarding };

async function handleStaff(req, res) {
  const url = new URL(req.url, 'http://localhost'); const match = url.pathname.match(/^\/api\/staff(?:\/([^/]+))?$/); if (!match) return false;
  const user = await session(req, res, req.method === 'GET' ? 'read' : 'staff'); if (!user) return true;
  try {
    if (req.method === 'GET') { const result = await db.query('SELECT u.id, u.employee_id AS "employeeId", u.display_name AS "displayName", u.email, m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=$1 ORDER BY u.display_name', [user.organization_id]); return json(res, 200, { data: result.rows }); }
    if (req.method === 'POST') { const input = await readBody(req); if (typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || !['principal','administrator','faculty','accountant','read_only'].includes(input.role)) return fail(res, 400, 'VALIDATION_ERROR', 'Valid staff email and role are required.'); const result = await db.query('INSERT INTO memberships (organization_id,user_id,role) SELECT $1,u.id,$3 FROM users u WHERE lower(u.email)=lower($2) RETURNING user_id', [user.organization_id, input.email.trim(), input.role]); if (!result.rowCount) return fail(res, 404, 'NOT_FOUND', 'User must register before being added to staff.'); await db.query("UPDATE users SET employee_id = 'CF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) WHERE id = $1 AND employee_id IS NULL", [result.rows[0].user_id]); const staff = await db.query('SELECT u.id,u.employee_id AS "employeeId",u.display_name AS "displayName",u.email,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=$1 AND u.id=$2', [user.organization_id, result.rows[0].user_id]); await writeAuditLog(user, 'staff_add', 'staff', staff.rows[0].id, { role: input.role, email: input.email.trim(), employeeId: staff.rows[0].employeeId }); return json(res, 201, staff.rows[0]); }
    if (req.method === 'DELETE' && match[1]) { const existing = await db.query('SELECT user_id, role FROM memberships WHERE organization_id=$1 AND user_id=$2', [user.organization_id, match[1]]); if (!existing.rowCount) return fail(res, 404, 'NOT_FOUND', 'Staff member not found or cannot be removed.'); const result = await db.query('DELETE FROM memberships WHERE organization_id=$1 AND user_id=$2 AND role <> $3 RETURNING user_id', [user.organization_id, match[1], 'owner']); if (!result.rowCount) return fail(res, 404, 'NOT_FOUND', 'Staff member not found or cannot be removed.'); await writeAuditLog(user, 'staff_remove', 'staff', match[1], { role: existing.rows[0].role }); return json(res, 200, { ok: true }); }
    return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  } catch (error) { return fail(res, error.code === '23505' ? 409 : 500, error.code === '23505' ? 'CONFLICT' : 'INTERNAL_ERROR', error.code === '23505' ? 'User is already connected to this workspace.' : 'Unable to update staff.'); }
}
module.exports.handleStaff = handleStaff;
