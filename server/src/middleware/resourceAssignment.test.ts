import assert from 'node:assert/strict';
import test from 'node:test';
import { RoleType } from '@prisma/client';
import { assertResourceAssignment } from './resourceAssignment.js';

const resource = { subjectId: 'subject-1', sectionId: 'section-1', departmentId: 'dept-1' };

test('requires an exact subject and section assignment for faculty', () => {
  assert.doesNotThrow(() =>
    assertResourceAssignment({ role: RoleType.FACULTY, resource, assignments: [resource] })
  );
  for (const wrongAssignment of [
    { subjectId: 'subject-2', sectionId: 'section-1' },
    { subjectId: 'subject-1', sectionId: 'section-2' },
  ]) {
    assert.throws(
      () => assertResourceAssignment({ role: RoleType.FACULTY, resource, assignments: [wrongAssignment] }),
      (error: { status?: number }) => error.status === 403
    );
  }
});

test('allows an HOD override only within the HOD department', () => {
  assert.doesNotThrow(() =>
    assertResourceAssignment({
      role: RoleType.HOD,
      actorDepartmentId: 'dept-1',
      resource,
      assignments: [],
    })
  );
  assert.throws(
    () => assertResourceAssignment({
      role: RoleType.HOD,
      actorDepartmentId: 'dept-2',
      resource,
      assignments: [],
    }),
    (error: { status?: number }) => error.status === 403
  );
});

test('allows administrators to override assignment checks', () => {
  for (const role of [RoleType.ADMIN, RoleType.SUPER_ADMIN]) {
    assert.doesNotThrow(() =>
      assertResourceAssignment({ role, resource, assignments: [] })
    );
  }
});

test('returns not found for resources outside the scoped institution', () => {
  assert.throws(
    () => assertResourceAssignment({ role: RoleType.FACULTY, resource: null, assignments: [] }),
    (error: { status?: number }) => error.status === 404
  );
});

test('protects canvas session access with the same subject and section assignment', () => {
  assert.doesNotThrow(() =>
    assertResourceAssignment({
      role: RoleType.FACULTY,
      resource,
      assignments: [{ subjectId: 'subject-1', sectionId: 'section-1' }],
    })
  );
  assert.throws(
    () => assertResourceAssignment({
      role: RoleType.FACULTY,
      resource,
      assignments: [{ subjectId: 'subject-1', sectionId: 'section-2' }],
    }),
    (error: { status?: number }) => error.status === 403
  );
});
