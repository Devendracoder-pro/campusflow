const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');

function emptyState() {
  return core.seed();
}

test('new workspaces contain no seeded records', () => {
  const state = emptyState();
  assert.deepEqual(state.students, []);
  assert.deepEqual(state.faculty, []);
  assert.deepEqual(state.courses, []);
  assert.deepEqual(state.payments, []);
  assert.deepEqual(state.attendance, []);
});

test('records can be added with validated relationships', () => {
  let state = emptyState();
  state = core.saveRecord(state, 'faculty', {
    name: 'Dr. Test Faculty', email: 'faculty@test.edu', department: 'Science', designation: 'Lecturer'
  });
  state = core.saveRecord(state, 'courses', {
    name: 'Test Computing', code: 'TC101', department: 'Science', credits: '4', facultyId: state.faculty[0].id, fee: '25000'
  });
  state = core.saveRecord(state, 'students', {
    name: 'Test Student', roll: 'TC-001', email: 'student@test.edu', courseId: state.courses[0].id, year: '1', status: 'Active', joined: core.dateKey()
  });
  assert.equal(state.faculty.length, 1);
  assert.equal(state.courses.length, 1);
  assert.equal(state.students.length, 1);
});

test('duplicate emails and invalid payments are rejected', () => {
  let state = emptyState();
  state = core.saveRecord(state, 'faculty', {
    name: 'Faculty One', email: 'same@test.edu', department: 'Science', designation: 'Lecturer'
  });
  assert.throws(() => core.saveRecord(state, 'faculty', {
    name: 'Faculty Two', email: 'same@test.edu', department: 'Science', designation: 'Lecturer'
  }), /already in use/);
  assert.throws(() => core.addPayment(state, {
    studentId: 'missing', amount: '100', date: core.dateKey(), method: 'Cash'
  }), /existing student/);
});

test('state backups are validated before import', () => {
  const state = emptyState();
  assert.deepEqual(core.validateState(state), state);
  assert.throws(() => core.validateState({ ...state, version: 99 }), /Unsupported backup format/);
});
