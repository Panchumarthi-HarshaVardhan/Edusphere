import bcrypt from 'bcrypt';
import {
  AssessmentType,
  AttendanceStatus,
  MaterialType,
  PostScope,
  PostSection,
  PublicationState,
  RoleType,
} from '@prisma/client';
import { prisma } from '../../src/utils/prisma.js';

export const TEST_PASSWORD = 'Integration-Test-Password123!';

type InstitutionFixture = {
  institution: { id: string; code: string };
  department: { id: string };
  section: { id: string };
  otherSection: { id: string };
  subject: { id: string };
  otherSubject: { id: string };
  users: Record<RoleType, { id: string; email: string }>;
  material: { id: string; allowDownload: boolean };
  noDownloadMaterial: { id: string };
  unpublishedMaterial: { id: string };
  otherSectionMaterial: { id: string };
  attendanceSession: { id: string };
  assessmentDraft: { id: string };
  assessmentPublished: { id: string };
  post: { id: string };
  doubt: { id: string };
};

export type IntegrationSeed = { A: InstitutionFixture; B: InstitutionFixture };

async function createInstitutionFixture(suffix: 'a' | 'b', passwordHash: string): Promise<InstitutionFixture> {
  const institution = await prisma.institution.create({
    data: {
      name: `Test Institution ${suffix.toUpperCase()}`,
      code: `TEST_${suffix.toUpperCase()}`,
      defaultAttendanceThreshold: 75,
    },
  });
  const department = await prisma.department.create({
    data: { institutionId: institution.id, name: `Department ${suffix}`, code: `D${suffix.toUpperCase()}` },
  });
  const program = await prisma.program.create({
    data: {
      institutionId: institution.id,
      departmentId: department.id,
      name: `Program ${suffix}`,
      code: `P${suffix.toUpperCase()}`,
    },
  });
  const academicYear = await prisma.academicYear.create({
    data: {
      institutionId: institution.id,
      name: '2099-2100',
      startDate: new Date('2099-08-01T00:00:00.000Z'),
      endDate: new Date('2100-05-31T00:00:00.000Z'),
      isCurrent: true,
    },
  });
  const semester = await prisma.semester.create({
    data: {
      institutionId: institution.id,
      academicYearId: academicYear.id,
      programId: program.id,
      semesterNumber: 1,
      name: 'Semester 1',
      startDate: new Date('2099-08-01T00:00:00.000Z'),
      endDate: new Date('2100-05-31T00:00:00.000Z'),
    },
  });
  const [section, otherSection] = await Promise.all([
    prisma.section.create({ data: { institutionId: institution.id, semesterId: semester.id, name: 'Section A' } }),
    prisma.section.create({ data: { institutionId: institution.id, semesterId: semester.id, name: 'Section B' } }),
  ]);
  const [subject, otherSubject] = await Promise.all([
    prisma.subject.create({
      data: { institutionId: institution.id, semesterId: semester.id, name: 'Assigned Subject', code: `S${suffix}1` },
    }),
    prisma.subject.create({
      data: { institutionId: institution.id, semesterId: semester.id, name: 'Unassigned Subject', code: `S${suffix}2` },
    }),
  ]);

  const users = {} as Record<RoleType, { id: string; email: string }>;
  for (const role of Object.values(RoleType)) {
    const user = await prisma.user.create({
      data: {
        institutionId: institution.id,
        email: `${role.toLowerCase()}@${suffix}.example.test`,
        passwordHash,
        firstName: role === RoleType.STUDENT ? `Student ${suffix}` : `${role} ${suffix}`,
        lastName: 'Fixture',
        role,
        departmentId: role === RoleType.HOD || role === RoleType.FACULTY || role === RoleType.CLASS_INCHARGE
          ? department.id
          : null,
        mustResetPassword: false,
      },
      select: { id: true, email: true },
    });
    users[role] = user;
  }

  await prisma.studentEnrollment.create({
    data: {
      institutionId: institution.id,
      studentId: users[RoleType.STUDENT].id,
      sectionId: section.id,
      rollNumber: `${suffix.toUpperCase()}-A`,
    },
  });
  await prisma.facultyAssignment.create({
    data: {
      institutionId: institution.id,
      facultyId: users[RoleType.FACULTY].id,
      subjectId: subject.id,
      sectionId: section.id,
    },
  });
  await prisma.facultyAssignment.create({
    data: {
      institutionId: institution.id,
      facultyId: users[RoleType.CLASS_INCHARGE].id,
      subjectId: subject.id,
      sectionId: section.id,
    },
  });

  const makeMaterial = async (title: string, targetSectionId: string, visibleFrom: Date, allowDownload: boolean) => {
    const material = await prisma.studyMaterial.create({
      data: {
        institutionId: institution.id,
        subjectId: subject.id,
        createdById: users[RoleType.FACULTY].id,
        title,
        type: MaterialType.PDF,
        visibleFrom,
        allowDownload,
        targetSections: { create: [{ sectionId: targetSectionId }] },
        versions: {
          create: {
            institutionId: institution.id,
            versionNumber: 1,
            originalFilename: `${title}.pdf`,
            mimeType: 'application/pdf',
            fileSizeBytes: 12,
            s3Key: `${institution.id}/materials/${title.replaceAll(' ', '_')}.pdf`,
          },
        },
      },
      select: { id: true, allowDownload: true },
    });
    return material;
  };

  const now = new Date(Date.now() - 60_000);
  const [material, noDownloadMaterial, unpublishedMaterial, otherSectionMaterial] = await Promise.all([
    makeMaterial(`Published ${suffix}`, section.id, now, true),
    makeMaterial(`No Download ${suffix}`, section.id, now, false),
    makeMaterial(`Unpublished ${suffix}`, section.id, new Date(Date.now() + 86_400_000), true),
    makeMaterial(`Other Section ${suffix}`, otherSection.id, now, true),
  ]);

  const attendanceSession = await prisma.attendanceSession.create({
    data: {
      institutionId: institution.id,
      subjectId: subject.id,
      sectionId: section.id,
      facultyId: users[RoleType.FACULTY].id,
      sessionDate: new Date('2099-09-01T00:00:00.000Z'),
      periodNumber: 1,
      isCompleted: true,
      records: {
        create: [
          { institutionId: institution.id, studentId: users[RoleType.STUDENT].id, status: AttendanceStatus.PRESENT },
        ],
      },
    },
    select: { id: true },
  });

  const createAssessment = async (name: string, state: PublicationState) =>
    prisma.assessment.create({
      data: {
        institutionId: institution.id,
        subjectId: subject.id,
        sectionId: section.id,
        facultyId: users[RoleType.FACULTY].id,
        name,
        type: AssessmentType.INTERNAL_1,
        maxMarks: 100,
        state,
        publishedAt: state === PublicationState.PUBLISHED ? new Date() : null,
        marks: {
          create: [
            {
              institutionId: institution.id,
              studentId: users[RoleType.STUDENT].id,
              score: state === PublicationState.PUBLISHED ? 65 : 40,
              gradeLetter: 'B',
            },
          ],
        },
      },
      select: { id: true },
    });
  const [assessmentDraft, assessmentPublished] = await Promise.all([
    createAssessment(`Draft ${suffix}`, PublicationState.DRAFT),
    createAssessment(`Published ${suffix}`, PublicationState.PUBLISHED),
  ]);

  const post = await prisma.communityPost.create({
    data: {
      institutionId: institution.id,
      authorId: users[RoleType.STUDENT].id,
      scope: PostScope.INSTITUTION,
      section: PostSection.UNIVERSITY_FEED,
      content: `Post ${suffix}`,
    },
    select: { id: true },
  });
  const doubt = await prisma.doubt.create({
    data: {
      institutionId: institution.id,
      subjectId: subject.id,
      studentId: users[RoleType.STUDENT].id,
      title: `Anonymous doubt ${suffix}`,
      content: 'Please explain this topic.',
      isAnonymous: true,
    },
    select: { id: true },
  });

  return {
    institution: { id: institution.id, code: institution.code },
    department,
    section,
    otherSection,
    subject,
    otherSubject,
    users,
    material,
    noDownloadMaterial,
    unpublishedMaterial,
    otherSectionMaterial,
    attendanceSession,
    assessmentDraft,
    assessmentPublished,
    post,
    doubt,
  };
}

export async function seedTwoInstitutions(): Promise<IntegrationSeed> {
  await prisma.institution.deleteMany();
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
  const [A, B] = await Promise.all([
    createInstitutionFixture('a', passwordHash),
    createInstitutionFixture('b', passwordHash),
  ]);
  return { A, B };
}

export async function seedAttendanceRecords(
  fixture: InstitutionFixture,
  statuses: AttendanceStatus[]
) {
  const sessions = await Promise.all(
    statuses.map((status, index) =>
      prisma.attendanceSession.create({
        data: {
          institutionId: fixture.institution.id,
          subjectId: fixture.subject.id,
          sectionId: fixture.section.id,
          facultyId: fixture.users[RoleType.FACULTY].id,
          sessionDate: new Date(Date.UTC(2099, 8, 2 + index)),
          periodNumber: index + 2,
          isCompleted: true,
          records: {
            create: [{
              institutionId: fixture.institution.id,
              studentId: fixture.users[RoleType.STUDENT].id,
              status,
            }],
          },
        },
        select: { id: true },
      })
    )
  );
  return sessions;
}
