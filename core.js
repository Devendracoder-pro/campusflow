(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.CampusCore = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'campusflow-v2';
  const departments = ['Computer Science', 'Business Administration', 'Commerce', 'Humanities', 'Science'];
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const clone = value => JSON.parse(JSON.stringify(value));
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function text(value, label, max = 120) {
    assert(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label} is required (maximum ${max} characters).`);
    return value.trim();
  }
  function email(value) {
    const result = text(value, 'Email', 160).toLowerCase();
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result), 'Enter a valid email address.');
    return result;
  }
  function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  }
  function money(value, label, allowZero = false) {
    assert((typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '', `${label} is required.`);
    const result = Number(value);
    assert(Number.isFinite(result) && result >= (allowZero ? 0 : 0.01) && result <= 10000000 && Math.abs(result * 100 - Math.round(result * 100)) < 0.00001, `${label} must be ${allowZero ? 'zero or ' : ''}a positive amount with up to two decimal places (maximum 10,000,000).`);
    return result;
  }
  function normalizeRecord(state, type, input, id) {
    assert(['students', 'faculty', 'courses'].includes(type), 'Unknown record type.');
    let record;
    if (type === 'courses') {
      const credits = Number(input.credits);
      assert(Number.isInteger(credits) && credits >= 1 && credits <= 12, 'Credits must be an integer between 1 and 12.');
      assert(departments.includes(input.department), 'Choose a valid department.');
      assert(!input.facultyId || state.faculty.some(f => f.id === input.facultyId), 'Choose an existing faculty member.');
      record = { id, name: text(input.name, 'Course name'), code: text(input.code, 'Course code', 20).toUpperCase(), department: input.department, credits, facultyId: input.facultyId || '', fee: money(input.fee, 'Course fee', true) };
      assert(!state.courses.some(c => c.id !== id && c.code === record.code), 'A course with this code already exists.');
    } else if (type === 'students') {
      assert(state.courses.some(c => c.id === input.courseId), 'Choose an existing course.');
      assert(['Active', 'Graduated', 'On leave'].includes(input.status), 'Choose a valid student status.');
      const year = Number(input.year);
      assert(Number.isInteger(year) && year >= 1 && year <= 6, 'Study year must be between 1 and 6.');
      assert(validDate(input.joined), 'Choose a valid enrollment date.');
      record = { id, name: text(input.name, 'Student name'), roll: text(input.roll, 'Roll number', 30).toUpperCase(), email: email(input.email), courseId: input.courseId, year, status: input.status, joined: input.joined };
      assert(!state.students.some(s => s.id !== id && s.roll === record.roll), 'A student with this roll number already exists.');
    } else {
      assert(departments.includes(input.department), 'Choose a valid department.');
      record = { id, name: text(input.name, 'Faculty name'), email: email(input.email), department: input.department, designation: text(input.designation, 'Designation', 80) };
    }
    if (record.email) assert(!state[type].some(r => r.id !== id && r.email === record.email), 'This email address is already in use.');
    return record;
  }
  function log(state, message) {
    state.activity.unshift({ id: uid(), message, at: new Date().toISOString() });
    state.activity = state.activity.slice(0, 30);
  }
  function saveRecord(state, type, input, id) {
    const next = clone(state);
    assert(!id || next[type]?.some(r => r.id === id), 'Record no longer exists.');
    const record = normalizeRecord(next, type, input, id || uid());
    if (type === 'students' && id) {
      const paid = totalPaid(next, id);
      assert(paid <= next.courses.find(c => c.id === record.courseId).fee, 'The selected course fee is lower than this student’s recorded payments.');
    }
    if (type === 'courses') {
      assert(!next.students.some(s => s.courseId === record.id && totalPaid(next, s.id) > record.fee), 'The course fee cannot be lower than an enrolled student’s recorded payments.');
    }
    if (id) next[type] = next[type].map(r => r.id === id ? record : r);
    else next[type].push(record);
    log(next, `${id ? 'Updated' : 'Added'} ${type === 'courses' ? 'course' : type === 'faculty' ? 'faculty member' : 'student'}: ${record.name}`);
    return next;
  }
  function removeRecord(state, type, id) {
    assert(['students', 'faculty', 'courses'].includes(type), 'Unknown record type.');
    const next = clone(state);
    const record = next[type].find(r => r.id === id);
    assert(record, 'Record no longer exists.');
    if (type === 'courses') assert(!next.students.some(s => s.courseId === id), 'Reassign enrolled students before deleting this course.');
    if (type === 'students') assert(!next.payments.some(p => p.studentId === id), 'Students with payment records cannot be deleted. Change their status instead.');
    next[type] = next[type].filter(r => r.id !== id);
    if (type === 'faculty') next.courses.forEach(c => { if (c.facultyId === id) c.facultyId = ''; });
    if (type === 'students') next.attendance = next.attendance.filter(a => a.studentId !== id);
    log(next, `Deleted ${record.name}`);
    return next;
  }
  function totalPaid(state, studentId) { return Math.round(state.payments.filter(p => p.studentId === studentId).reduce((sum, p) => sum + p.amount, 0) * 100) / 100; }
  function balance(state, studentId) {
    const student = state.students.find(s => s.id === studentId);
    return student ? Math.round(((state.courses.find(c => c.id === student.courseId)?.fee || 0) - totalPaid(state, studentId)) * 100) / 100 : 0;
  }
  function addPayment(state, input) {
    const next = clone(state);
    const student = next.students.find(s => s.id === input.studentId);
    assert(student, 'Choose an existing student.');
    const amount = money(input.amount, 'Payment amount');
    assert(amount <= balance(next, student.id), 'Payment exceeds the outstanding balance.');
    assert(validDate(input.date) && input.date <= dateKey(), 'Payment date must be today or earlier.');
    assert(['Bank transfer', 'Cash', 'Card', 'UPI'].includes(input.method), 'Choose a valid payment method.');
    next.payments.push({ id: uid(), studentId: student.id, amount, date: input.date, method: input.method });
    log(next, `Payment recorded for ${student.name}`);
    return next;
  }
  function saveAttendance(state, date, entries) {
    assert(validDate(date) && date <= dateKey(), 'Attendance date must be today or earlier.');
    assert(Array.isArray(entries) && entries.length > 0, 'No attendance entries to save.');
    const next = clone(state);
    const seen = new Set();
    entries.forEach(entry => {
      assert(next.students.some(s => s.id === entry.studentId && s.status === 'Active'), 'Attendance can only be marked for active students.');
      assert(!seen.has(entry.studentId), 'Duplicate attendance entry.');
      seen.add(entry.studentId);
      assert(['Present', 'Absent', 'Late', 'Unmarked'].includes(entry.status), 'Invalid attendance status.');
      next.attendance = next.attendance.filter(a => !(a.studentId === entry.studentId && a.date === date));
      if (entry.status !== 'Unmarked') next.attendance.push({ studentId: entry.studentId, date, status: entry.status });
    });
    log(next, `Saved attendance for ${date} (${entries.length} students)`);
    return next;
  }
  function validateState(input) {
    assert(input && typeof input === 'object' && input.version === 1, 'Unsupported backup format.');
    ['students', 'faculty', 'courses', 'payments', 'attendance', 'activity'].forEach(key => assert(Array.isArray(input[key]) && input[key].length <= 100000, `Invalid ${key} data.`));
    const next = { version: 1, students: [], faculty: [], courses: [], payments: [], attendance: [], activity: [] };
    for (const type of ['faculty', 'courses', 'students']) {
      input[type].forEach(r => {
        assert(r && typeof r === 'object', `Invalid ${type} record.`);
        const id = text(r.id, 'Record ID');
        assert(!next[type].some(x => x.id === id), 'Duplicate record ID.');
        next[type].push(normalizeRecord(next, type, r, id));
      });
    }
    input.payments.forEach(p => {
      assert(p && typeof p === 'object', 'Invalid payment record.');
      const id = text(p.id, 'Payment ID');
      assert(!next.payments.some(x => x.id === id), 'Duplicate payment ID.');
      assert(next.students.some(s => s.id === p.studentId), 'Payment references a missing student.');
      const amount = money(p.amount, 'Payment amount');
      assert(amount <= balance(next, p.studentId), 'Backup contains an overpayment.');
      assert(validDate(p.date) && p.date <= dateKey() && ['Bank transfer', 'Cash', 'Card', 'UPI'].includes(p.method), 'Invalid payment details.');
      next.payments.push({ id, studentId: p.studentId, amount, date: p.date, method: p.method });
    });
    const attendanceKeys = new Set();
    input.attendance.forEach(a => {
      assert(a && next.students.some(s => s.id === a.studentId) && validDate(a.date) && a.date <= dateKey() && ['Present', 'Absent', 'Late'].includes(a.status), 'Invalid attendance record.');
      const key = `${a.studentId}|${a.date}`;
      assert(!attendanceKeys.has(key), 'Duplicate attendance record.');
      attendanceKeys.add(key);
      next.attendance.push({ studentId: a.studentId, date: a.date, status: a.status });
    });
    input.activity.slice(0, 30).forEach(a => {
      assert(a && typeof a.at === 'string' && !Number.isNaN(Date.parse(a.at)), 'Invalid activity timestamp.');
      next.activity.push({ id: text(a.id, 'Activity ID'), message: text(a.message, 'Activity message', 300), at: a.at });
    });
    return next;
  }
  function csv(rows) {
    return rows.map(row => row.map(value => {
      let safe = String(value ?? '');
      if (/^[\s]*[=+\-@]/.test(safe) || /^[\t\r\n]/.test(safe)) safe = "'" + safe;
      return '"' + safe.replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
  }
  function seed() {
    return { version: 1, students: [], faculty: [], courses: [], payments: [], attendance: [], activity: [] };
  }
  return { STORAGE_KEY, departments, dateKey, seed, saveRecord, removeRecord, addPayment, saveAttendance, balance, totalPaid, validateState, csv, validDate };
});