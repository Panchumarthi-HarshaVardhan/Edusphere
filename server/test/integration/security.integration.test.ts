import bcrypt from 'bcrypt';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { AttendanceStatus, CalendarEventType, PostScope, PublicationState, RoleType, TimetableOverrideType } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { prisma } from '../../src/utils/prisma.js';
import { TEST_PASSWORD, seedAttendanceRecords, seedTwoInstitutions, type IntegrationSeed } from '../helpers/seed.js';

let fixture: IntegrationSeed;

beforeEach(async () => {
  fixture = await seedTwoInstitutions();
});

afterAll(async () => {
  await prisma.institution.deleteMany();
  await prisma.$disconnect();
});

async function login(institutionCode: string, role: RoleType) {
  const result = await request(app)
    .post('/api/auth/login')
    .send({
      institutionCode,
      email: `${role.toLowerCase()}@${institutionCode.endsWith('_A') ? 'a' : 'b'}.example.test`,
      password: TEST_PASSWORD,
    });
  expect(result.status).toBe(200);
  return { accessToken: result.body.accessToken as string, refreshToken: result.body.refreshToken as string };
}

const auth = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

describe('attendance session workflow', () => {
  it('returns the subject and section context needed by the attendance dialog', async () => {
    const faculty = await login(fixture.A.institution.code, RoleType.FACULTY);
    const response = await request(app)
      .post('/api/attendance/sessions')
      .set(auth(faculty.accessToken))
      .send({
        subjectId: fixture.A.subject.id,
        sectionId: fixture.A.section.id,
        sessionDate: '2100-01-02T00:00:00.000Z',
        periodNumber: 2,
      });

    expect(response.status).toBe(200);
    expect(response.body.session.subject).toMatchObject({
      id: fixture.A.subject.id,
      code: 'Sa1',
      name: 'Assigned Subject',
    });
    expect(response.body.session.section).toMatchObject({
      id: fixture.A.section.id,
      name: 'Section A',
    });
  });
});

describe('user privacy controls', () => {
  it('exports only the authenticated user’s institution-scoped account and academic records', async () => {
    const student = await login(fixture.A.institution.code, RoleType.STUDENT);
    const response = await request(app).get('/api/privacy/me/export').set(auth(student.accessToken));
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('attachment;');
    expect(response.body.profile.email).toBe(fixture.A.users[RoleType.STUDENT].email);
    expect(response.body.profile).not.toHaveProperty('passwordHash');
    expect(response.body.education.enrollments.length).toBeGreaterThan(0);
    expect(response.body.education.attendanceRecords.length).toBeGreaterThan(0);
    expect(response.body.education.studentMarks.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toContain(fixture.B.users[RoleType.STUDENT].email);
    expect(await prisma.auditLog.count({ where: { institutionId: fixture.A.institution.id, userId: fixture.A.users[RoleType.STUDENT].id, action: 'USER_DATA_EXPORTED' } })).toBe(1);
  });

  it('anonymizes account identity while preserving academic records and writing an audit entry', async () => {
    const studentId = fixture.A.users[RoleType.STUDENT].id;
    const student = await login(fixture.A.institution.code, RoleType.STUDENT);
    const enrollmentCount = await prisma.studentEnrollment.count({ where: { institutionId: fixture.A.institution.id, studentId } });
    const markCount = await prisma.studentMark.count({ where: { institutionId: fixture.A.institution.id, studentId } });
    const response = await request(app).delete('/api/privacy/me').set(auth(student.accessToken));
    expect(response.status).toBe(200);
    const savedUser = await prisma.user.findFirstOrThrow({ where: { institutionId: fixture.A.institution.id, id: studentId } });
    expect(savedUser.isAnonymized).toBe(true);
    expect(savedUser.isActive).toBe(false);
    expect(savedUser.email).toMatch(/@anonymized\.invalid$/);
    expect(savedUser.firstName).toBe('Anonymized');
    expect(await prisma.studentEnrollment.count({ where: { institutionId: fixture.A.institution.id, studentId } })).toBe(enrollmentCount);
    expect(await prisma.attendanceRecord.count({ where: { institutionId: fixture.A.institution.id, studentId } })).toBe(1);
    expect(await prisma.studentMark.count({ where: { institutionId: fixture.A.institution.id, studentId } })).toBe(markCount);
    expect(await prisma.doubt.count({ where: { institutionId: fixture.A.institution.id, studentId } })).toBe(0);
    expect(await prisma.communityPost.count({ where: { institutionId: fixture.A.institution.id, authorId: studentId } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { institutionId: fixture.A.institution.id, userId: studentId, action: 'USER_DATA_ANONYMIZED' } })).toBe(1);
    expect((await request(app).get('/api/community/feed').set(auth(student.accessToken))).status).toBe(401);
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);
    expect((await request(app).patch(`/api/admin/users/${studentId}/status`).set(auth(admin.accessToken)).send({ isActive: true })).status).toBe(409);
  });

  it('blocks minor community access until an administrator records guardian consent', async () => {
    const studentId = fixture.A.users[RoleType.STUDENT].id;
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);
    const markedMinor = await request(app).patch(`/api/admin/users/${studentId}/minor-status`).set(auth(admin.accessToken)).send({ isMinor: true });
    expect(markedMinor.status).toBe(200);
    const student = await login(fixture.A.institution.code, RoleType.STUDENT);
    const blocked = await request(app).get('/api/community/feed').set(auth(student.accessToken));
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('GUARDIAN_CONSENT_REQUIRED');

    const adminB = await login(fixture.B.institution.code, RoleType.ADMIN);
    expect((await request(app).post(`/api/admin/users/${studentId}/guardian-consent`).set(auth(adminB.accessToken)).send({
      guardianName: 'Wrong tenant', guardianEmail: 'guardian@b.example.test', relationship: 'parent',
      consentMethod: 'verified_email', policyVersion: '2026-1',
    })).status).toBe(404);
    const recorded = await request(app).post(`/api/admin/users/${studentId}/guardian-consent`).set(auth(admin.accessToken)).send({
      guardianName: 'Guardian A', guardianEmail: 'guardian@a.example.test', relationship: 'parent',
      consentMethod: 'verified_email', policyVersion: '2026-1',
    });
    expect(recorded.status).toBe(201);
    const activeConsent = await prisma.guardianConsent.findFirst({ where: { institutionId: fixture.A.institution.id, userId: studentId } });
    expect(activeConsent?.revokedAt).toBeNull();
    expect((await request(app).get('/api/community/feed').set(auth(student.accessToken))).status).toBe(200);
    expect((await request(app).delete(`/api/admin/users/${studentId}/guardian-consent`).set(auth(admin.accessToken))).status).toBe(200);
    expect((await request(app).get('/api/community/feed').set(auth(student.accessToken))).status).toBe(403);
  });

  it('stores institution-scoped data retention settings and audits policy changes', async () => {
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);
    const updated = await request(app).put('/api/admin/data-retention').set(auth(admin.accessToken)).send({
      inactiveAccountRetentionDays: 730, auditLogRetentionDays: 1825,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.settings.inactiveAccountRetentionDays).toBe(730);
    expect(updated.body.settings.auditLogRetentionDays).toBe(1825);
    expect(await prisma.auditLog.count({ where: { institutionId: fixture.A.institution.id, action: 'DATA_RETENTION_SETTINGS_UPDATED' } })).toBe(1);
    const adminB = await login(fixture.B.institution.code, RoleType.ADMIN);
    const otherTenantSettings = await request(app).get('/api/admin/data-retention').set(auth(adminB.accessToken));
    expect(otherTenantSettings.body.settings.inactiveAccountRetentionDays).toBeNull();
    expect(otherTenantSettings.body.settings.auditLogRetentionDays).toBeNull();
  });
});

describe('self-service profile editing', () => {
  it('updates only the authenticated user’s name, validates input, and records an audit log', async () => {
    const student = await login(fixture.A.institution.code, RoleType.STUDENT);
    const response = await request(app)
      .patch('/api/auth/profile')
      .set(auth(student.accessToken))
      .send({ firstName: 'Updated', lastName: 'Learner' });

    expect(response.status).toBe(200);
    expect(response.body.user.firstName).toBe('Updated');
    expect(response.body.user.lastName).toBe('Learner');
    expect(response.body.user.role).toBe(RoleType.STUDENT);
    const stored = await prisma.user.findFirstOrThrow({
      where: { id: fixture.A.users[RoleType.STUDENT].id, institutionId: fixture.A.institution.id },
    });
    expect(stored.firstName).toBe('Updated');
    expect(stored.lastName).toBe('Learner');

    const forbiddenField = await request(app)
      .patch('/api/auth/profile')
      .set(auth(student.accessToken))
      .send({ firstName: 'Updated', lastName: 'Learner', role: RoleType.ADMIN });
    expect(forbiddenField.status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: stored.id } })).role).toBe(RoleType.STUDENT);
    expect(await prisma.auditLog.count({
      where: { institutionId: fixture.A.institution.id, userId: stored.id, action: 'USER_PROFILE_UPDATED' },
    })).toBe(1);
  });
});

describe('health endpoint', () => {
  it('returns an unauthenticated API liveness response', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('EduSphere API');
  });
});

describe('tenant isolation', () => {
  it('blocks cross-institution reads and writes for materials, attendance, marks, posts, and users', async () => {
    const studentA = await login(fixture.A.institution.code, RoleType.STUDENT);
    const facultyA = await login(fixture.A.institution.code, RoleType.FACULTY);
    const adminA = await login(fixture.A.institution.code, RoleType.ADMIN);

    expect((await request(app).get(`/api/materials/${fixture.B.material.id}`).set(auth(studentA.accessToken))).status)
      .toBe(404);
    expect((await request(app).post(`/api/materials/${fixture.B.material.id}/bookmark`).set(auth(studentA.accessToken))).status)
      .toBe(404);

    expect((await request(app)
      .put(`/api/attendance/sessions/${fixture.B.attendanceSession.id}`)
      .set(auth(facultyA.accessToken))
      .send({ marks: [] })).status).toBe(404);

    expect((await request(app)
      .put(`/api/marks/assessments/${fixture.B.assessmentDraft.id}/marks`)
      .set(auth(facultyA.accessToken))
      .send({ entries: [] })).status).toBe(404);

    const feed = await request(app).get('/api/community/feed').set(auth(studentA.accessToken));
    expect(feed.status).toBe(200);
    expect(JSON.stringify(feed.body)).not.toContain(fixture.B.post.id);

    const bPostBefore = await prisma.communityPost.findUniqueOrThrow({ where: { id: fixture.B.post.id } });
    const likeOtherTenantPost = await request(app)
      .post(`/api/community/posts/${fixture.B.post.id}/like`)
      .set(auth(studentA.accessToken));
    expect(likeOtherTenantPost.status).toBeGreaterThanOrEqual(400);
    const bPostAfter = await prisma.communityPost.findUniqueOrThrow({ where: { id: fixture.B.post.id } });
    expect(bPostAfter.likesCount).toBe(bPostBefore.likesCount);

    const crossTenantComment = await request(app)
      .post(`/api/community/posts/${fixture.B.post.id}/comments`)
      .set(auth(studentA.accessToken))
      .send({ content: 'Cross-tenant comment attempt' });
    expect(crossTenantComment.status).toBeGreaterThanOrEqual(400);
    const foreignComments = await prisma.postComment.count({
      where: { institutionId: fixture.A.institution.id, postId: fixture.B.post.id },
    });
    expect(foreignComments).toBe(0);

    const foreignMaterialWrite = await request(app)
      .post('/api/materials')
      .set(auth(facultyA.accessToken))
      .send({ institutionId: fixture.B.institution.id, subjectId: fixture.B.subject.id });
    expect(foreignMaterialWrite.status).toBe(403);

    const foreignPostWrite = await request(app)
      .post('/api/community/posts')
      .set(auth(studentA.accessToken))
      .send({ institutionId: fixture.B.institution.id, content: 'Cross-tenant attempt' });
    expect(foreignPostWrite.status).toBe(403);

    const usersA = await request(app).get('/api/admin/users').set(auth(adminA.accessToken));
    expect(usersA.status).toBe(200);
    expect(JSON.stringify(usersA.body)).not.toContain('@b.example.test');

    const foreignUserWrite = await request(app)
      .patch(`/api/admin/users/${fixture.B.users[RoleType.STUDENT].id}/status`)
      .set(auth(adminA.accessToken))
      .send({ isActive: false });
    expect(foreignUserWrite.status).toBeGreaterThanOrEqual(400);
    const bUser = await prisma.user.findUniqueOrThrow({ where: { id: fixture.B.users[RoleType.STUDENT].id } });
    expect(bUser.isActive).toBe(true);
  });
});

describe('faculty assignment enforcement', () => {
  it('returns only the seeded faculty user’s assigned subject-section pairs', async () => {
    const faculty = await login(fixture.A.institution.code, RoleType.FACULTY);
    const response = await request(app).get('/api/dashboard/faculty').set(auth(faculty.accessToken));
    expect(response.status).toBe(200);
    expect(response.body.assignedSubjects).toEqual(expect.arrayContaining([
      expect.objectContaining({ subjectId: fixture.A.subject.id, sectionId: fixture.A.section.id }),
    ]));
    expect(response.body.assignedSubjects).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ subjectId: fixture.B.subject.id, sectionId: fixture.B.section.id }),
    ]));
    const subjectOptions = await request(app).get('/api/materials/subjects').set(auth(faculty.accessToken));
    expect(subjectOptions.status).toBe(200);
    expect(subjectOptions.body.subjects.map((subject: any) => subject.id)).toContain(fixture.A.subject.id);
    expect(subjectOptions.body.subjects.map((subject: any) => subject.id)).not.toContain(fixture.B.subject.id);

    const wrongSection = await request(app).post('/api/materials').set(auth(faculty.accessToken)).send({
      subjectId: fixture.A.subject.id, targetSectionIds: JSON.stringify([fixture.B.section.id]),
    });
    expect(wrongSection.status).toBe(403);

    const validUpload = await request(app)
      .post('/api/materials')
      .set(auth(faculty.accessToken))
      .field('subjectId', fixture.A.subject.id)
      .field('targetSectionIds', JSON.stringify([fixture.A.section.id]))
      .field('title', 'Faculty upload test')
      .field('type', 'PDF')
      .field('visibleFrom', new Date().toISOString())
      .field('allowDownload', 'true')
      .attach('file', Buffer.from('%PDF-1.4 test material'), { filename: 'notes.pdf', contentType: 'application/pdf' });
    expect(validUpload.status).toBe(201);
  });

  it('denies attendance and marks writes for an unassigned subject-section pair', async () => {
    const faculty = await login(fixture.A.institution.code, RoleType.FACULTY);
    const unassignedAttendance = await prisma.attendanceSession.create({
      data: {
        institutionId: fixture.A.institution.id,
        subjectId: fixture.A.otherSubject.id,
        sectionId: fixture.A.section.id,
        facultyId: fixture.A.users[RoleType.ADMIN].id,
      },
      select: { id: true },
    });
    const unassignedAssessment = await prisma.assessment.create({
      data: {
        institutionId: fixture.A.institution.id,
        subjectId: fixture.A.otherSubject.id,
        sectionId: fixture.A.section.id,
        facultyId: fixture.A.users[RoleType.ADMIN].id,
        name: 'Unassigned Assessment',
        type: 'INTERNAL_1',
        maxMarks: 100,
      },
      select: { id: true },
    });

    expect((await request(app)
      .put(`/api/attendance/sessions/${unassignedAttendance.id}`)
      .set(auth(faculty.accessToken))
      .send({ marks: [] })).status).toBe(403);

    expect((await request(app)
      .put(`/api/marks/assessments/${unassignedAssessment.id}/marks`)
      .set(auth(faculty.accessToken))
      .send({ entries: [] })).status).toBe(403);

    expect((await request(app)
      .patch(`/api/marks/assessments/${unassignedAssessment.id}/publish`)
      .set(auth(faculty.accessToken))
      .send({ state: PublicationState.PUBLISHED })).status).toBe(403);

    const unassignedCanvasSession = await prisma.classroomSession.create({
      data: {
        institutionId: fixture.A.institution.id,
        subjectId: fixture.A.otherSubject.id,
        sectionId: fixture.A.section.id,
        facultyId: fixture.A.users[RoleType.ADMIN].id,
        title: 'Unassigned canvas lesson',
      },
      select: { id: true },
    });
    expect((await request(app).get(`/api/canvas/sessions/${unassignedCanvasSession.id}`).set(auth(faculty.accessToken))).status).toBe(403);
    expect((await request(app)
      .post(`/api/canvas/sessions/${unassignedCanvasSession.id}/pages`)
      .set(auth(faculty.accessToken))).status).toBe(403);
  });
});

describe('student self-service privacy', () => {
  it('ignores another user id in student attendance and marks reports', async () => {
    const student = await login(fixture.A.institution.code, RoleType.STUDENT);
    const attendance = await request(app)
      .get('/api/attendance/student-aggregate')
      .set(auth(student.accessToken))
      .query({ studentId: fixture.A.users[RoleType.ADMIN].id });
    expect(attendance.status).toBe(200);
    expect(attendance.body.totalConducted).toBeGreaterThan(0);

    const marks = await request(app)
      .get('/api/marks/student-report')
      .set(auth(student.accessToken))
      .query({ studentId: fixture.A.users[RoleType.ADMIN].id });
    expect(marks.status).toBe(200);
    expect(marks.body.subjectsSummary.length).toBeGreaterThan(0);
  });
});

describe('faculty canvas lesson sharing', () => {
  it('keeps a lesson private until faculty finishes class, then lets enrolled students read it and its image assets', async () => {
    const faculty = await login(fixture.A.institution.code, RoleType.FACULTY);
    const student = await login(fixture.A.institution.code, RoleType.STUDENT);
    const session = await prisma.classroomSession.create({
      data: {
        institutionId: fixture.A.institution.id,
        subjectId: fixture.A.subject.id,
        sectionId: fixture.A.section.id,
        facultyId: fixture.A.users[RoleType.FACULTY].id,
        title: 'Completed Canvas Lesson',
        pages: { create: { institutionId: fixture.A.institution.id, pageNumber: 1, strokesJson: [] } },
      },
      select: { id: true },
    });

    expect((await request(app).get('/api/canvas/sessions').set(auth(student.accessToken))).body.sessions)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: session.id })]));
    expect((await request(app).get(`/api/canvas/sessions/${session.id}`).set(auth(student.accessToken))).status).toBe(404);

    const upload = await request(app)
      .post(`/api/canvas/sessions/${session.id}/assets/upload`)
      .set(auth(faculty.accessToken))
      .attach('file', Buffer.from('canvas-image-bytes'), { filename: 'diagram.png', contentType: 'image/png' });
    expect(upload.status).toBe(200);

    expect((await request(app).post(`/api/canvas/sessions/${session.id}/complete`).set(auth(faculty.accessToken))).status).toBe(200);
    const studentSessions = await request(app).get('/api/canvas/sessions').set(auth(student.accessToken));
    expect(studentSessions.body.sessions).toEqual(expect.arrayContaining([expect.objectContaining({ id: session.id })]));
    expect((await request(app).get(`/api/canvas/sessions/${session.id}`).set(auth(student.accessToken))).status).toBe(200);
    expect((await request(app).get(`/api/canvas/assets/${upload.body.id}`).set(auth(student.accessToken))).status).toBe(200);
  });
});

describe('admin analytics and audit filters', () => {
  it('aggregates tenant data with academic filters and exports shortage CSV', async () => {
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);
    const dashboard = await request(app).get('/api/admin/analytics/dashboard').set(auth(admin.accessToken)).query({ sectionId: fixture.A.section.id });
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.counts.students).toBe(1);
    expect(dashboard.body.counts.faculty).toBe(2);
    expect(dashboard.body.attendanceByDepartment).toEqual(expect.arrayContaining([
      expect.objectContaining({ department: 'Department a', attendancePercentage: 100 }),
    ]));
    const exportResult = await request(app).get('/api/admin/analytics/attendance-shortages/export').set(auth(admin.accessToken)).query({ sectionId: fixture.A.section.id, format: 'csv' });
    expect(exportResult.status).toBe(200);
    expect(exportResult.headers['content-type']).toContain('text/csv');
    expect(exportResult.text).toContain('"firstName","lastName","email"');
    const foreignFilter = await request(app).get('/api/admin/analytics/dashboard').set(auth(admin.accessToken)).query({ sectionId: fixture.B.section.id });
    expect(foreignFilter.status).toBe(200);
    expect(foreignFilter.body.counts.students).toBe(0);
  });

  it('filters audit logs by user, action, and inclusive date range', async () => {
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);
    const start = new Date('2025-01-10T12:00:00.000Z');
    const selected = await prisma.auditLog.create({ data: { institutionId: fixture.A.institution.id, userId: fixture.A.users[RoleType.STUDENT].id, action: 'FILTERED_TEST_ACTION', resource: 'test', createdAt: start } });
    await prisma.auditLog.create({ data: { institutionId: fixture.A.institution.id, userId: fixture.A.users[RoleType.FACULTY].id, action: 'FILTERED_TEST_ACTION', resource: 'test', createdAt: start } });
    const result = await request(app).get('/api/admin/audit-logs').set(auth(admin.accessToken)).query({ userId: fixture.A.users[RoleType.STUDENT].id, action: 'FILTERED_TEST_ACTION', startDate: '2025-01-10', endDate: '2025-01-10' });
    expect(result.status).toBe(200);
    expect(result.body.logs.map((row: any) => row.id)).toEqual([selected.id]);
  });
});

describe('community attachments', () => {
  it('lets authenticated users attach files to any feed and protects attachment reads by post visibility', async () => {
    const studentA = await login(fixture.A.institution.code, RoleType.STUDENT);
    const studentB = await login(fixture.B.institution.code, RoleType.STUDENT);
    const created = await request(app)
      .post('/api/community/posts')
      .set(auth(studentA.accessToken))
      .field('postData', JSON.stringify({ scope: PostScope.INSTITUTION, section: 'CLUBS', title: 'Club photo', content: 'Join our club.' }))
      .attach('files', Buffer.from('image-bytes'), 'club-photo.png')
      .attach('files', Buffer.from('event-details'), 'event-details.txt');

    expect(created.status).toBe(201);
    expect(created.body.post.images).toHaveLength(1);
    expect(created.body.post.documents).toHaveLength(2);
    const imageUrl = created.body.post.images[0] as string;
    const imagePath = new URL(imageUrl).pathname;
    const image = await request(app).get(imagePath).set(auth(studentA.accessToken));
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toContain('image/png');
    expect(image.body.toString()).toBe('image-bytes');
    expect((await request(app).get(imagePath)).status).toBe(401);
    expect((await request(app).get(imagePath).set(auth(studentB.accessToken))).status).toBe(404);
  });
});

describe('announcement audience and notifications', () => {
  it('notifies the exact institution, department, year, and section audiences and does not leak scoped posts through search', async () => {
    const author = await login(fixture.A.institution.code, RoleType.FACULTY);
    const targets = await request(app).get('/api/community/announcement-targets').set(auth(author.accessToken));
    expect(targets.status).toBe(200);
    expect(targets.body.sections.map((section: any) => section.id)).toContain(fixture.A.section.id);
    expect(targets.body.sections.map((section: any) => section.id)).not.toContain(fixture.B.section.id);
    expect((await request(app).get('/api/community/announcement-targets')).status).toBe(401);
    const otherStudent = await prisma.user.create({ data: {
      institutionId: fixture.A.institution.id, email: 'second.student@a.example.test', passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
      firstName: 'Second', lastName: 'Student', role: RoleType.STUDENT, mustResetPassword: false,
    }, select: { id: true } });
    await prisma.studentEnrollment.create({ data: { institutionId: fixture.A.institution.id, studentId: otherStudent.id, sectionId: fixture.A.otherSection.id, rollNumber: 'A-SECOND' } });
    const scopeTargets: Array<{ scope: PostScope; extra: Record<string, string>; expected: string[] }> = [
      { scope: PostScope.INSTITUTION, extra: {}, expected: [...Object.values(fixture.A.users).filter((u) => u.id !== fixture.A.users[RoleType.FACULTY].id).map((u) => u.id), otherStudent.id] },
      { scope: PostScope.DEPARTMENT, extra: { departmentId: fixture.A.department.id }, expected: [RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.STUDENT].map((role) => fixture.A.users[role as RoleType].id).concat(otherStudent.id) },
      { scope: PostScope.YEAR, extra: { academicYearId: (await prisma.semester.findFirstOrThrow({ where: { institutionId: fixture.A.institution.id }, select: { academicYearId: true } })).academicYearId }, expected: [fixture.A.users[RoleType.CLASS_INCHARGE].id, fixture.A.users[RoleType.STUDENT].id, otherStudent.id] },
      { scope: PostScope.SECTION, extra: { sectionId: fixture.A.section.id }, expected: [fixture.A.users[RoleType.CLASS_INCHARGE].id, fixture.A.users[RoleType.STUDENT].id] },
    ];
    for (const { scope, extra, expected } of scopeTargets) {
      const title = `Audience ${scope} unique`;
      const created = await request(app).post('/api/community/posts').set(auth(author.accessToken)).send({ scope, ...extra, title, content: `Notice for ${scope}`, isVerifiedAnnouncement: true });
      expect(created.status).toBe(201);
      const notifications = await prisma.notification.findMany({ where: { institutionId: fixture.A.institution.id, title: `Verified Announcement: ${title}` }, select: { userId: true } });
      expect(new Set(notifications.map((notification) => notification.userId))).toEqual(new Set(expected));
      expect(notifications.some((notification) => notification.userId === fixture.B.users[RoleType.STUDENT].id)).toBe(false);
    }
    const otherStudentToken = await request(app).post('/api/auth/login').send({ institutionCode: fixture.A.institution.code, email: 'second.student@a.example.test', password: TEST_PASSWORD });
    expect(otherStudentToken.status).toBe(200);
    const filteredFeed = await request(app).get('/api/community/feed').set(auth(otherStudentToken.body.accessToken)).query({ search: 'Audience SECTION unique' });
    expect(filteredFeed.status).toBe(200);
    expect(filteredFeed.body).not.toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Audience SECTION unique' })]));
    const studentA = await login(fixture.A.institution.code, RoleType.STUDENT);
    const visibleDashboard = await request(app).get('/api/dashboard/student').set(auth(studentA.accessToken));
    expect(visibleDashboard.body.announcements).toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Audience SECTION unique' })]));
    const hiddenDashboard = await request(app).get('/api/dashboard/student').set(auth(otherStudentToken.body.accessToken));
    expect(hiddenDashboard.body.announcements).not.toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Audience SECTION unique' })]));
    const studentVerifiedPost = await request(app).post('/api/community/posts').set(auth(otherStudentToken.body.accessToken)).send({ scope: PostScope.INSTITUTION, title: 'Unauthorized verified post', content: 'Not allowed', isVerifiedAnnouncement: true });
    expect(studentVerifiedPost.status).toBe(400);
    const hod = await login(fixture.A.institution.code, RoleType.HOD);
    const hodVerifiedPost = await request(app).post('/api/community/posts').set(auth(hod.accessToken)).send({ scope: PostScope.INSTITUTION, title: 'HOD verified post', content: 'Not allowed', isVerifiedAnnouncement: true });
    expect(hodVerifiedPost.status).toBe(400);
    const hodBroadcast = await request(app).post('/api/dashboard/announcements').set(auth(hod.accessToken)).send({ title: 'HOD broadcast', content: 'Not allowed' });
    expect(hodBroadcast.status).toBe(403);
    const foreignTarget = await request(app).post('/api/community/posts').set(auth(author.accessToken)).send({ scope: PostScope.SECTION, sectionId: fixture.B.section.id, title: 'Foreign target', content: 'Should be rejected', isVerifiedAnnouncement: true });
    expect(foreignTarget.status).toBe(400);
  });
});

describe('email queue health', () => {
  it('reports tenant-scoped queue and failed counts to admins only', async () => {
    await prisma.emailJobQueue.createMany({ data: [
      { institutionId: fixture.A.institution.id, recipientEmail: 'pending@example.test', subject: 'Pending', htmlBody: '<p>Pending</p>', status: 'PENDING' },
      { institutionId: fixture.A.institution.id, recipientEmail: 'failed@example.test', subject: 'Failed', htmlBody: '<p>Failed</p>', status: 'FAILED', attempts: 5, lastError: 'provider error' },
    ] });
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);
    const health = await request(app).get('/api/notifications/email-queue/health').set(auth(admin.accessToken));
    expect(health.status).toBe(200);
    expect(health.body.queueSize).toBe(1);
    expect(health.body.failedJobs).toBe(1);
    const student = await login(fixture.A.institution.code, RoleType.STUDENT);
    expect((await request(app).get('/api/notifications/email-queue/health').set(auth(student.accessToken))).status).toBe(403);
    const adminB = await login(fixture.B.institution.code, RoleType.ADMIN);
    const otherTenant = await request(app).get('/api/notifications/email-queue/health').set(auth(adminB.accessToken));
    expect(otherTenant.body.queueSize).toBe(0);
    expect(otherTenant.body.failedJobs).toBe(0);
  });
});

describe('material access', () => {
  it('requires authentication and enforces publication, enrollment, and download settings', async () => {
    expect((await request(app).get(`/api/materials/${fixture.A.material.id}/view-url`)).status).toBe(401);
    const student = await login(fixture.A.institution.code, RoleType.STUDENT);
    expect((await request(app).get(`/api/materials/subjects/${fixture.B.subject.id}/units`).set(auth(student.accessToken))).status).toBe(404);

    expect((await request(app)
      .get(`/api/materials/${fixture.A.noDownloadMaterial.id}/download-url`)
      .set(auth(student.accessToken))).status).toBe(403);
    expect((await request(app)
      .get(`/api/materials/${fixture.A.unpublishedMaterial.id}/view-url`)
      .set(auth(student.accessToken))).status).toBe(404);
    expect((await request(app)
      .get(`/api/materials/${fixture.A.otherSectionMaterial.id}/view-url`)
      .set(auth(student.accessToken))).status).toBe(404);
  });
});

describe('timetable and academic calendar', () => {
  it('imports valid timetable rows and reports invalid rows without losing them', async () => {
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);
    await request(app).post('/api/calendar/periods').set(auth(admin.accessToken)).send({
      number: 1, name: 'Morning', startTime: '09:00', endTime: '10:00',
    }).expect(201);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Timetable');
    sheet.addRow(['sectionName', 'subjectCode', 'facultyEmail', 'periodNumber', 'dayOfWeek', 'roomNumber']);
    sheet.addRow(['Section A', 'SA1', fixture.A.users[RoleType.FACULTY].email, 1, 'Monday', 'Room 10']);
    sheet.addRow(['Missing Section', 'NOPE', 'not-an-email', 1, 'Funday', '']);
    const file = Buffer.from(await workbook.xlsx.writeBuffer());
    const response = await request(app)
      .post('/api/calendar/timetable/import')
      .set(auth(admin.accessToken))
      .attach('file', file, 'weekly-timetable.xlsx');

    expect(response.status).toBe(200);
    expect(response.body.importedCount).toBe(1);
    expect(response.body.errorCount).toBe(1);
    expect(response.body.errors[0].row).toBe(3);
    expect(await prisma.timetableSlot.count({ where: { institutionId: fixture.A.institution.id } })).toBe(1);
    const adminB = await login(fixture.B.institution.code, RoleType.ADMIN);
    const otherTenantSlots = await request(app).get('/api/calendar/timetable').set(auth(adminB.accessToken));
    expect(otherTenantSlots.body).toHaveLength(0);
    expect(await prisma.auditLog.count({ where: { institutionId: fixture.A.institution.id, action: 'IMPORT_TIMETABLE' } })).toBe(1);
  });

  it('scopes schedule setup by institution, rejects section/faculty/room clashes, and serves dated calendar overrides', async () => {
    const adminA = await login(fixture.A.institution.code, RoleType.ADMIN);
    const adminB = await login(fixture.B.institution.code, RoleType.ADMIN);
    const dayOfWeek = new Date().getUTCDay() || 7;
    const today = new Date().toISOString().slice(0, 10);
    const period = async (token: string, number: number, name: string) => {
      const response = await request(app).post('/api/calendar/periods').set(auth(token)).send({
        number, name, startTime: '09:00', endTime: '10:00',
      });
      expect(response.status).toBe(201);
      return response.body.id as string;
    };
    const p1 = await period(adminA.accessToken, 1, 'Period 1');
    const p2 = await period(adminA.accessToken, 2, 'Period 2');
    await period(adminB.accessToken, 1, 'Period 1');

    const base = await request(app).post('/api/calendar/timetable').set(auth(adminA.accessToken)).send({
      sectionId: fixture.A.section.id, subjectId: fixture.A.subject.id,
      facultyId: fixture.A.users[RoleType.FACULTY].id, periodId: p1, dayOfWeek, roomNumber: 'R-1',
    });
    expect(base.status).toBe(201);
    const foreignTimetable = await request(app).get('/api/calendar/timetable').set(auth(adminB.accessToken));
    expect(foreignTimetable.status).toBe(200);
    expect(foreignTimetable.body).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: base.body.id })]));

    await prisma.facultyAssignment.createMany({ data: [
      { institutionId: fixture.A.institution.id, facultyId: fixture.A.users[RoleType.FACULTY].id, subjectId: fixture.A.subject.id, sectionId: fixture.A.otherSection.id },
      { institutionId: fixture.A.institution.id, facultyId: fixture.A.users[RoleType.CLASS_INCHARGE].id, subjectId: fixture.A.subject.id, sectionId: fixture.A.otherSection.id },
    ] });
    const createSlot = (sectionId: string, facultyId: string, periodId: string, roomNumber: string) =>
      request(app).post('/api/calendar/timetable').set(auth(adminA.accessToken)).send({
        sectionId, subjectId: fixture.A.subject.id, facultyId, periodId, dayOfWeek, roomNumber,
      });
    const facultyClash = await createSlot(fixture.A.otherSection.id, fixture.A.users[RoleType.FACULTY].id, p2, 'R-2');
    expect(facultyClash.status).toBe(409);
    expect(facultyClash.body.details.map((item: any) => item.type)).toContain('faculty');
    const roomClash = await createSlot(fixture.A.otherSection.id, fixture.A.users[RoleType.CLASS_INCHARGE].id, p2, 'r-1');
    expect(roomClash.status).toBe(409);
    expect(roomClash.body.details.map((item: any) => item.type)).toContain('room');
    const sectionClash = await createSlot(fixture.A.section.id, fixture.A.users[RoleType.CLASS_INCHARGE].id, p2, 'R-2');
    expect(sectionClash.status).toBe(409);
    expect(sectionClash.body.details.map((item: any) => item.type)).toContain('section');

    const holiday = await request(app).post('/api/calendar/events').set(auth(adminA.accessToken)).send({
      type: CalendarEventType.HOLIDAY, title: 'Institution Holiday', startDate: today, endDate: today,
    });
    expect(holiday.status).toBe(201);
    const otherSectionEvent = await request(app).post('/api/calendar/events').set(auth(adminA.accessToken)).send({
      type: CalendarEventType.EXAM, title: 'Other section exam', sectionId: fixture.A.otherSection.id, startDate: today, endDate: today,
    });
    expect(otherSectionEvent.status).toBe(201);

    const substituteId = fixture.A.users[RoleType.CLASS_INCHARGE].id;
    const override = await request(app).post(`/api/calendar/timetable/${base.body.id}/overrides`).set(auth(adminA.accessToken)).send({
      date: today, type: TimetableOverrideType.SUBSTITUTE, substituteFacultyId: substituteId, note: 'Covering this class',
    });
    expect(override.status).toBe(201);
    expect(await prisma.notification.count({ where: { institutionId: fixture.A.institution.id, userId: fixture.A.users[RoleType.STUDENT].id } })).toBeGreaterThan(0);

    const student = await login(fixture.A.institution.code, RoleType.STUDENT);
    expect(await prisma.academicCalendarEvent.count({ where: { institutionId: fixture.A.institution.id } })).toBe(2);
    const calendar = await request(app).get('/api/calendar/me').set(auth(student.accessToken));
    expect(calendar.status).toBe(200);
    expect(calendar.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Institution Holiday', type: CalendarEventType.HOLIDAY }),
      expect.objectContaining({ slotId: base.body.id, status: 'SCHEDULED', faculty: expect.objectContaining({ id: substituteId }) }),
    ]));
    expect(calendar.body.items).not.toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Other section exam' })]));
    const unauthenticated = await request(app).get('/api/calendar/me');
    expect(unauthenticated.status).toBe(401);
  });
});

describe('published marks', () => {
  it('hides draft marks and audits edits to published marks with a reason', async () => {
    const student = await login(fixture.A.institution.code, RoleType.STUDENT);
    const faculty = await login(fixture.A.institution.code, RoleType.FACULTY);
    const report = await request(app).get('/api/marks/student-report').set(auth(student.accessToken));
    const reportText = JSON.stringify(report.body);
    expect(report.status).toBe(200);
    expect(reportText).toContain('Published a');
    expect(reportText).not.toContain('Draft a');

    const mark = await prisma.studentMark.findFirstOrThrow({
      where: { assessmentId: fixture.A.assessmentPublished.id },
    });
    const noReason = await request(app)
      .put(`/api/marks/assessments/${fixture.A.assessmentPublished.id}/marks`)
      .set(auth(faculty.accessToken))
      .send({ entries: [{ studentId: mark.studentId, score: 70 }] });
    expect(noReason.status).toBe(400);

    const edit = await request(app)
      .put(`/api/marks/assessments/${fixture.A.assessmentPublished.id}/marks`)
      .set(auth(faculty.accessToken))
      .send({ entries: [{ studentId: mark.studentId, score: 70 }], reason: 'Approved recheck' });
    expect(edit.status).toBe(200);

    const audit = await prisma.auditLog.findFirst({
      where: {
        institutionId: fixture.A.institution.id,
        action: 'PUBLISHED_MARKS_EDITED',
        resourceId: fixture.A.assessmentPublished.id,
      },
    });
    expect(audit?.details).toMatchObject({ reason: 'Approved recheck' });
  });
});

describe('anonymous doubts', () => {
  it('hides the author from other students and logs administrator identity reveal', async () => {
    const peer = await prisma.user.create({
      data: {
        institutionId: fixture.A.institution.id,
        email: 'peer@student.example.test',
        passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
        firstName: 'Peer',
        lastName: 'Student',
        role: RoleType.STUDENT,
        mustResetPassword: false,
      },
      select: { id: true, email: true },
    });
    const peerToken = (await request(app).post('/api/auth/login').send({
      institutionCode: fixture.A.institution.code,
      email: peer.email,
      password: TEST_PASSWORD,
    })).body.accessToken as string;
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);

    for (const token of [peerToken, admin.accessToken]) {
      const detail = await request(app)
        .get(`/api/community/doubts/${fixture.A.doubt.id}`)
        .set(auth(token));
      expect(detail.status).toBe(200);
      expect(detail.body.student.firstName).toBe('Anonymous');
      expect(detail.body.student.email).toBeUndefined();
    }

    const priorAuditCount = await prisma.auditLog.count({
      where: { institutionId: fixture.A.institution.id, action: 'REVEAL_ANONYMOUS_AUTHOR' },
    });
    expect(priorAuditCount).toBe(0);
    const reveal = await request(app)
      .get(`/api/community/doubts/${fixture.A.doubt.id}/reveal-author`)
      .set(auth(admin.accessToken));
    expect(reveal.status).toBe(200);
    expect(reveal.body.author.email).toBe(fixture.A.users[RoleType.STUDENT].email);
    expect(await prisma.auditLog.count({
      where: { institutionId: fixture.A.institution.id, action: 'REVEAL_ANONYMOUS_AUTHOR' },
    })).toBe(1);
  });
});

describe('attendance percentage', () => {
  it('computes the percentage from per-session records', async () => {
    await seedAttendanceRecords(fixture.A, [AttendanceStatus.ABSENT]);
    const student = await login(fixture.A.institution.code, RoleType.STUDENT);
    const aggregate = await request(app)
      .get('/api/attendance/student-aggregate')
      .set(auth(student.accessToken));
    expect(aggregate.status).toBe(200);
    expect(aggregate.body.overallPercentage).toBe(50);
    expect(aggregate.body.totalConducted).toBe(2);
  });

  it('gives late records half credit consistently in subject and overall totals', async () => {
    await seedAttendanceRecords(fixture.A, [AttendanceStatus.LATE, AttendanceStatus.ABSENT]);
    await prisma.attendanceSession.create({
      data: {
        institutionId: fixture.A.institution.id,
        subjectId: fixture.A.subject.id,
        sectionId: fixture.A.section.id,
        facultyId: fixture.A.users[RoleType.FACULTY].id,
        sessionDate: new Date('2100-09-10T00:00:00.000Z'),
        periodNumber: 4,
        isCompleted: false,
        records: {
          create: [{
            institutionId: fixture.A.institution.id,
            studentId: fixture.A.users[RoleType.STUDENT].id,
            status: AttendanceStatus.ABSENT,
          }],
        },
      },
    });
    const student = await login(fixture.A.institution.code, RoleType.STUDENT);
    const aggregate = await request(app)
      .get('/api/attendance/student-aggregate')
      .set(auth(student.accessToken));
    expect(aggregate.status).toBe(200);
    expect(aggregate.body.overallPercentage).toBe(50);
    expect(aggregate.body.attendanceCredits).toBe(1.5);
    expect(aggregate.body.subjectMetrics[0].percentage).toBe(50);
    expect(aggregate.body.subjectMetrics[0].attendanceCredits).toBe(1.5);
    const dashboard = await request(app)
      .get('/api/dashboard/student')
      .set(auth(student.accessToken));
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.attendance.overallPercentage).toBe(aggregate.body.overallPercentage);
    expect(dashboard.body.attendance.totalConducted).toBe(aggregate.body.totalConducted);
  });
});

describe('authentication', () => {
  it('rotates refresh tokens and rejects reuse of the previous token', async () => {
    const initial = await login(fixture.A.institution.code, RoleType.STUDENT);
    const rotated = await request(app).post('/api/auth/refresh').send({ refreshToken: initial.refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(initial.refreshToken);

    const replay = await request(app).post('/api/auth/refresh').send({ refreshToken: initial.refreshToken });
    expect(replay.status).toBe(401);
  });

  it('forces first-login password reset before other authenticated APIs', async () => {
    const resetUser = await prisma.user.create({
      data: {
        institutionId: fixture.A.institution.id,
        email: 'must-reset@student.example.test',
        passwordHash: await bcrypt.hash(TEST_PASSWORD, 4),
        firstName: 'Reset',
        lastName: 'Required',
        role: RoleType.STUDENT,
        mustResetPassword: true,
      },
    });
    const loginResult = await request(app).post('/api/auth/login').send({
      institutionCode: fixture.A.institution.code,
      email: resetUser.email,
      password: TEST_PASSWORD,
    });
    expect(loginResult.status).toBe(200);
    const token = loginResult.body.accessToken as string;

    const blocked = await request(app).get('/api/materials').set(auth(token));
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_RESET_REQUIRED');

    const reset = await request(app)
      .post('/api/auth/reset-first-password')
      .set(auth(token))
      .send({ newPassword: 'New-Integration-Password123!' });
    expect(reset.status).toBe(200);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: resetUser.id } });
    expect(updated.mustResetPassword).toBe(false);
  });
});

describe('admin setup APIs', () => {
  it('creates and audits institution-scoped hierarchy records with zod validation', async () => {
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);
    const invalid = await request(app).post('/api/admin/setup/departments')
      .set(auth(admin.accessToken)).send({ name: '', code: '' });
    expect(invalid.status).toBe(400);

    const created = await request(app).post('/api/admin/setup/departments')
      .set(auth(admin.accessToken)).send({ name: 'Engineering', code: 'ENG' });
    expect(created.status).toBe(201);
    const departmentId = created.body.item.id as string;
    const update = await request(app).put(`/api/admin/setup/departments/${departmentId}`)
      .set(auth(admin.accessToken)).send({ name: 'Engineering & Design', code: 'ENG' });
    expect(update.status).toBe(200);
    const logs = await prisma.auditLog.findMany({ where: { institutionId: fixture.A.institution.id, resource: 'department' } });
    expect(logs.map((entry) => entry.action)).toContain('CREATE_DEPARTMENT');
    expect(logs.map((entry) => entry.action)).toContain('UPDATE_DEPARTMENT');

    const disposable = await request(app).post('/api/admin/setup/departments')
      .set(auth(admin.accessToken)).send({ name: 'Disposable', code: 'DISP' });
    const deleted = await request(app).delete(`/api/admin/setup/departments/${disposable.body.item.id}`).set(auth(admin.accessToken));
    expect(deleted.status).toBe(200);

    const crossTenantParent = await request(app).post('/api/admin/setup/programs')
      .set(auth(admin.accessToken))
      .send({ name: 'Foreign Parent Program', code: 'FP', departmentId: fixture.B.department.id });
    expect(crossTenantParent.status).toBe(404);
    const list = await request(app).get('/api/admin/setup/departments?search=Engineering&limit=10&offset=0')
      .set(auth(admin.accessToken));
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
  });

  it('lets only SUPER_ADMIN provision an institution with a first admin forced to reset', async () => {
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);
    const denied = await request(app).post('/api/admin/institutions').set(auth(admin.accessToken)).send({});
    expect(denied.status).toBe(403);

    const superAdmin = await login(fixture.A.institution.code, RoleType.SUPER_ADMIN);
    const created = await request(app).post('/api/admin/institutions').set(auth(superAdmin.accessToken)).send({
      name: 'Provisioned School', code: 'PROVISIONED', domain: 'provisioned.example.edu',
      admin: { email: 'first.admin@provisioned.example.edu', firstName: 'First', lastName: 'Admin' },
    });
    expect(created.status).toBe(201);
    expect(created.body.admin.role).toBe(RoleType.ADMIN);
    expect(created.body.admin.mustResetPassword).toBe(true);
    expect(created.body.temporaryPassword).toBeTruthy();
    const audit = await prisma.auditLog.findFirst({ where: { institutionId: created.body.institution.id, action: 'CREATE_INSTITUTION' } });
    expect(audit).toBeTruthy();
  });

  it('creates, resets, deactivates and reactivates tenant users with forced reset credentials', async () => {
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);
    const created = await request(app).post('/api/admin/users').set(auth(admin.accessToken)).send({
      email: 'new.student@a.example.test', firstName: 'New', lastName: 'Student', role: RoleType.STUDENT,
      sectionId: fixture.A.section.id, rollNumber: 'A-NEW-1',
    });
    expect(created.status).toBe(201);
    expect(created.body.user.mustResetPassword).toBe(true);
    expect(created.body.temporaryPassword).toBeTruthy();
    const userId = created.body.user.id as string;

    const reset = await request(app).post(`/api/admin/users/${userId}/reset-password`).set(auth(admin.accessToken));
    expect(reset.status).toBe(200);
    expect(reset.body.temporaryPassword).toBeTruthy();
    const statusOff = await request(app).patch(`/api/admin/users/${userId}/status`).set(auth(admin.accessToken)).send({ isActive: false });
    expect(statusOff.body.user.isActive).toBe(false);
    const statusOn = await request(app).patch(`/api/admin/users/${userId}/status`).set(auth(admin.accessToken)).send({ isActive: true });
    expect(statusOn.body.user.isActive).toBe(true);
    expect(await prisma.auditLog.count({ where: { institutionId: fixture.A.institution.id, resourceId: userId } })).toBeGreaterThanOrEqual(4);
  });

  it('assigns faculty, enrolls students, imports valid rows, reports invalid rows and serves templates', async () => {
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);
    const assignment = await request(app).post('/api/admin/faculty-assignments').set(auth(admin.accessToken)).send({
      facultyId: fixture.A.users[RoleType.FACULTY].id, subjectId: fixture.A.otherSubject.id, sectionId: fixture.A.section.id,
    });
    expect(assignment.status).toBe(201);
    const listedAssignments = await request(app).get('/api/admin/faculty-assignments').set(auth(admin.accessToken));
    expect(listedAssignments.status).toBe(200);
    expect(listedAssignments.body.assignments.some((item: any) => item.subjectId === fixture.A.otherSubject.id)).toBe(true);

    const unassignedStudent = await prisma.user.create({ data: {
      institutionId: fixture.A.institution.id, email: 'unenrolled@a.example.test', passwordHash: 'unused',
      firstName: 'Unenrolled', lastName: 'Student', role: RoleType.STUDENT, mustResetPassword: false,
    } });
    const enrollment = await request(app).post('/api/admin/student-enrollments').set(auth(admin.accessToken)).send({
      studentId: unassignedStudent.id, sectionId: fixture.A.otherSection.id, rollNumber: 'A-OTHER-1',
    });
    expect(enrollment.status).toBe(200);

    const csv = 'email,firstName,lastName,sectionId,rollNumber\nvalid.import@a.example.test,Valid,Imported,' + fixture.A.section.id + ',A-IMPORT-1\ninvalid-email,Missing,Fields,,\n';
    const imported = await request(app).post('/api/admin/users/import/students').set(auth(admin.accessToken))
      .attach('file', Buffer.from(csv), { filename: 'students.csv', contentType: 'text/csv' });
    expect(imported.status).toBe(200);
    expect(imported.body.imported).toBe(1);
    expect(imported.body.failed).toBe(1);
    expect(imported.body.results[1].errors.join(' ')).toContain('email:');
    const template = await request(app).get('/api/admin/users/import/students/template').set(auth(admin.accessToken));
    expect(template.status).toBe(200);
    expect(template.text).toContain('email,firstName,lastName,sectionId,rollNumber');
  });

  it('promotes active section enrollments to a section in the next academic year', async () => {
    const admin = await login(fixture.A.institution.code, RoleType.ADMIN);
    const currentSection = await prisma.section.findUniqueOrThrow({ where: { id: fixture.A.section.id }, include: { semester: true } });
    const year = await request(app).post('/api/admin/setup/academic-years').set(auth(admin.accessToken)).send({
      name: '2100-2101', startDate: '2100-08-01T00:00:00.000Z', endDate: '2101-05-31T00:00:00.000Z', isCurrent: false,
    });
    expect(year.status).toBe(201);
    const semester = await request(app).post('/api/admin/setup/semesters').set(auth(admin.accessToken)).send({
      name: 'Semester 1', semesterNumber: 1, startDate: '2100-08-01T00:00:00.000Z', endDate: '2101-05-31T00:00:00.000Z',
      academicYearId: year.body.item.id, programId: currentSection.semester.programId,
    });
    expect(semester.status).toBe(201);
    const target = await request(app).post('/api/admin/setup/sections').set(auth(admin.accessToken)).send({ name: 'Section A', semesterId: semester.body.item.id });
    expect(target.status).toBe(201);
    const promoted = await request(app).post(`/api/admin/sections/${fixture.A.section.id}/promote`).set(auth(admin.accessToken)).send({ targetSectionId: target.body.item.id });
    expect(promoted.status).toBe(200);
    expect(promoted.body.promotedCount).toBe(1);
    expect(await prisma.studentEnrollment.findFirst({ where: { institutionId: fixture.A.institution.id, studentId: fixture.A.users[RoleType.STUDENT].id, sectionId: target.body.item.id, status: 'ACTIVE' } })).toBeTruthy();
  });
});
