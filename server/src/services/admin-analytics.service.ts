import { AttendanceStatus, PublicationState, RoleType } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

export interface AnalyticsFilters {
  academicYearId?: string;
  departmentId?: string;
  semesterId?: string;
  sectionId?: string;
}

function sectionFilter(filters: AnalyticsFilters) {
  return {
    ...(filters.sectionId ? { id: filters.sectionId } : {}),
    semester: {
      ...(filters.semesterId ? { id: filters.semesterId } : {}),
      ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
      program: filters.departmentId ? { departmentId: filters.departmentId } : {},
    },
  };
}

function attended(status: AttendanceStatus): number {
  if (status === AttendanceStatus.PRESENT) return 1;
  if (status === AttendanceStatus.LATE) return 0.5;
  return 0;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export class AdminAnalyticsService {
  static async getDashboard(institutionId: string, filters: AnalyticsFilters = {}) {
    const institution = await prisma.institution.findFirst({
      where: { id: institutionId },
      select: { defaultAttendanceThreshold: true },
    });
    const threshold = institution?.defaultAttendanceThreshold ?? 75;
    const scopedSection = sectionFilter(filters);
    const communitySemesterSections = filters.semesterId
      ? (await prisma.section.findMany({
          where: { institutionId, semesterId: filters.semesterId },
          select: { id: true },
        })).map((section) => section.id)
      : undefined;

    const [enrollments, assignments, records, assessments, gradeRules, slots, posts] = await Promise.all([
      prisma.studentEnrollment.findMany({
        where: {
          institutionId,
          status: 'ACTIVE',
          student: { role: RoleType.STUDENT, isActive: true },
          section: scopedSection,
        },
        select: { studentId: true },
      }),
      prisma.facultyAssignment.findMany({
        where: {
          institutionId,
          faculty: { role: { in: [RoleType.FACULTY, RoleType.HOD, RoleType.CLASS_INCHARGE] }, isActive: true },
          section: scopedSection,
        },
        include: {
          faculty: { select: { id: true, firstName: true, lastName: true } },
          section: { select: { id: true } },
        },
      }),
      prisma.attendanceRecord.findMany({
        where: { institutionId, session: { section: scopedSection } },
        include: {
          student: { select: { id: true, email: true, firstName: true, lastName: true } },
          session: {
            include: {
              section: {
                include: { semester: { include: { program: { include: { department: true } } } } },
              },
            },
          },
        },
      }),
      prisma.assessment.findMany({
        where: { institutionId, state: PublicationState.PUBLISHED, section: scopedSection },
        include: {
          subject: { select: { id: true, code: true } },
          marks: {
            where: { institutionId, isAbsent: false, score: { not: null } },
            select: { id: true, gradeLetter: true },
          },
        },
      }),
      prisma.gradeRule.findMany({ where: { institutionId }, select: { gradeLetter: true, isPass: true } }),
      prisma.timetableSlot.findMany({ where: { institutionId, section: scopedSection }, select: { facultyId: true, subjectId: true, sectionId: true } }),
      prisma.communityPost.findMany({
        where: {
          institutionId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
          ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
          ...(filters.sectionId || communitySemesterSections ? {
            sectionId: filters.sectionId || { in: communitySemesterSections },
          } : {}),
        },
        select: { createdAt: true, _count: { select: { comments: true, likes: true } } },
      }),
    ]);

    const attendanceGroups = new Map<string, { departmentId: string; department: string; records: number; attended: number }>();
    const shortageGroups = new Map<string, {
      studentId: string; email: string; firstName: string; lastName: string; section: string; sectionId: string; totalSessions: number; attended: number;
    }>();
    for (const record of records) {
      const department = record.session.section.semester.program.department;
      const attendanceGroup = attendanceGroups.get(department.id) || {
        departmentId: department.id, department: department.name, records: 0, attended: 0,
      };
      attendanceGroup.records += 1;
      attendanceGroup.attended += attended(record.status);
      attendanceGroups.set(department.id, attendanceGroup);

      const section = record.session.section;
      const key = `${record.studentId}:${section.id}`;
      const shortageGroup = shortageGroups.get(key) || {
        studentId: record.student.id,
        email: record.student.email,
        firstName: record.student.firstName,
        lastName: record.student.lastName,
        section: section.name,
        sectionId: section.id,
        totalSessions: 0,
        attended: 0,
      };
      shortageGroup.totalSessions += 1;
      shortageGroup.attended += attended(record.status);
      shortageGroups.set(key, shortageGroup);
    }

    const attendanceByDepartment = Array.from(attendanceGroups.values())
      .map((group) => ({
        departmentId: group.departmentId,
        department: group.department,
        sessions: group.records,
        attendancePercentage: round1(group.records ? (group.attended / group.records) * 100 : 0),
      }))
      .sort((a, b) => a.department.localeCompare(b.department));

    const passRules = new Map(gradeRules.map((rule) => [rule.gradeLetter, rule.isPass]));
    const passGroups = new Map<string, { subjectId: string; subject: string; pass: number; total: number }>();
    for (const assessment of assessments) {
      const group = passGroups.get(assessment.subject.id) || {
        subjectId: assessment.subject.id, subject: assessment.subject.code, pass: 0, total: 0,
      };
      for (const mark of assessment.marks) {
        group.total += 1;
        const isPass = mark.gradeLetter === null ? false : (passRules.get(mark.gradeLetter) ?? mark.gradeLetter !== 'F');
        if (isPass) group.pass += 1;
      }
      passGroups.set(assessment.subject.id, group);
    }
    const passBySubject = Array.from(passGroups.values())
      .map((group) => ({
        subjectId: group.subjectId,
        subject: group.subject,
        passPercentage: round1(group.total ? (group.pass / group.total) * 100 : 0),
        students: group.total,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));

    const attendanceShortages = Array.from(shortageGroups.values())
      .map((group) => ({
        ...group,
        percentage: round1((group.attended / group.totalSessions) * 100),
      }))
      .filter((group) => group.percentage < threshold)
      .sort((a, b) => a.percentage - b.percentage || a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

    const workload = new Map<string, { facultyId: string; faculty: string; assignments: number; scheduledPeriods: number }>();
    for (const assignment of assignments) {
      const person = workload.get(assignment.facultyId) || {
        facultyId: assignment.facultyId,
        faculty: `${assignment.faculty.firstName} ${assignment.faculty.lastName}`,
        assignments: 0,
        scheduledPeriods: 0,
      };
      person.assignments += 1;
      person.scheduledPeriods += slots.filter((slot) =>
        slot.facultyId === assignment.facultyId && slot.subjectId === assignment.subjectId && slot.sectionId === assignment.sectionId
      ).length;
      workload.set(assignment.facultyId, person);
    }
    const facultyWorkload = Array.from(workload.values())
      .sort((a, b) => b.scheduledPeriods - a.scheduledPeriods || a.faculty.localeCompare(b.faculty));

    const activity = new Map<string, { date: string; posts: number; comments: number; likes: number }>();
    for (const post of posts) {
      const date = post.createdAt.toISOString().slice(0, 10);
      const day = activity.get(date) || { date, posts: 0, comments: 0, likes: 0 };
      day.posts += 1;
      day.comments += post._count.comments;
      day.likes += post._count.likes;
      activity.set(date, day);
    }

    return {
      filters,
      attendanceThreshold: threshold,
      counts: { students: new Set(enrollments.map((enrollment) => enrollment.studentId)).size, faculty: new Set(assignments.map((assignment) => assignment.facultyId)).size },
      attendanceByDepartment,
      passBySubject,
      attendanceShortages,
      facultyWorkload,
      communityActivity: Array.from(activity.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  static async getAttendanceShortages(institutionId: string, filters: AnalyticsFilters = {}, threshold?: number) {
    const institutionThreshold = threshold ?? (await prisma.institution.findFirst({
      where: { id: institutionId }, select: { defaultAttendanceThreshold: true },
    }))?.defaultAttendanceThreshold ?? 75;
    const records = await prisma.attendanceRecord.findMany({
      where: { institutionId, session: { section: sectionFilter(filters) } },
      include: {
        student: { select: { id: true, email: true, firstName: true, lastName: true } },
        session: { include: { section: { select: { id: true, name: true } } } },
      },
    });
    const groups = new Map<string, {
      studentId: string; email: string; firstName: string; lastName: string; section: string; sectionId: string; totalSessions: number; attended: number;
    }>();
    for (const record of records) {
      const section = record.session.section;
      const key = `${record.studentId}:${section.id}`;
      const group = groups.get(key) || {
        studentId: record.student.id, email: record.student.email, firstName: record.student.firstName,
        lastName: record.student.lastName, section: section.name, sectionId: section.id, totalSessions: 0, attended: 0,
      };
      group.totalSessions += 1;
      group.attended += attended(record.status);
      groups.set(key, group);
    }
    return Array.from(groups.values())
      .map((group) => ({ ...group, percentage: round1((group.attended / group.totalSessions) * 100) }))
      .filter((group) => group.percentage < institutionThreshold)
      .sort((a, b) => a.percentage - b.percentage || a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  }
}
