import { NotificationCategory, RoleType } from '@prisma/client';
import { NotificationService } from './notification.service.js';
import { prisma } from '../utils/prisma.js';
import { ScheduleService } from './schedule.service.js';
import { CommunityService } from './community.service.js';
import { PrivacyService } from './privacy.service.js';
import { attendanceCredit, attendancePercentage } from '../utils/attendance.js';

export class DashboardService {
  /**
   * 1. Student Dashboard Data Aggregator
   */
  static async getStudentDashboard(institutionId: string, studentId: string) {
    const communityAllowed = await PrivacyService.canUseCommunity(institutionId, studentId);
    // A. Student Enrollment & Section
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { institutionId, studentId, status: 'ACTIVE' },
      include: {
        section: {
          include: {
            semester: true,
          },
        },
      },
    });

    const sectionId = enrollment?.sectionId;

    // B. Today's and weekly schedule, including dated cancellations/substitutions.
    const todayDayOfWeek = new Date().getDay() || 7; // 1 (Mon) - 7 (Sun)
    let schedule: Awaited<ReturnType<typeof ScheduleService.getUserCalendar>> | null = null;
    if (sectionId) {
      schedule = await ScheduleService.getUserCalendar(institutionId, studentId, RoleType.STUDENT);
    }
    const timetable = schedule?.todayClasses ?? [];

    // C. Attendance Overview (SQL-Aggregated logic)
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { defaultAttendanceThreshold: true },
    });
    const threshold = institution?.defaultAttendanceThreshold || 75.0;

    const records = await prisma.attendanceRecord.findMany({
      where: { institutionId, studentId, session: { isCompleted: true } },
    });

    const totalConducted = records.length;
    let presentCount = 0;
    let lateCount = 0;
    let attendedScore = 0;
    for (const r of records) {
      if (r.status === 'PRESENT') presentCount++;
      if (r.status === 'LATE') lateCount++;
      attendedScore += attendanceCredit(r.status);
    }
    const overallPercentage = attendancePercentage(totalConducted, attendedScore);
    const hasShortage = overallPercentage < threshold;

    // D. Latest Published Marks (Rule 5: No drafts)
    const latestMarks = await prisma.studentMark.findMany({
      where: {
        institutionId,
        studentId,
        assessment: {
          state: 'PUBLISHED',
        },
      },
      include: {
        assessment: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // E. Recent Study Materials
    let recentMaterials: any[] = [];
    if (sectionId) {
      recentMaterials = await prisma.studyMaterial.findMany({
        where: {
          institutionId,
          visibleFrom: { lte: new Date() },
          targetSections: {
            some: { sectionId },
          },
        },
        include: {
          subject: true,
          unit: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
      });
    }

    // F. Announcements
    const [legacyAnnouncements, verifiedPosts] = await Promise.all([prisma.announcement.findMany({
      where: {
        institutionId,
        OR: [{ targetRole: null }, { targetRole: RoleType.STUDENT }],
      },
      include: {
        author: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }), communityAllowed ? CommunityService.getFeedPosts(institutionId, studentId, { isVerifiedAnnouncement: true }) : Promise.resolve([])]);
    const announcements = [
      ...legacyAnnouncements,
      ...verifiedPosts.map((post) => ({ ...post, title: post.title || 'Verified announcement' })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

    // G. Unanswered Doubts Asked by this Student
    const unansweredDoubts = communityAllowed ? await prisma.doubt.findMany({
      where: {
        institutionId,
        studentId,
        isResolved: false,
      },
      include: {
        subject: true,
      },
      orderBy: { createdAt: 'desc' },
    }) : [];

    return {
      enrollment,
      todayDayOfWeek,
      timetable,
      weeklyTimetable: schedule?.weeklyTimetable ?? [],
      calendar: schedule?.items ?? [],
      attendance: {
        totalConducted,
        presentCount,
        lateCount,
        attendedScore,
        overallPercentage,
        threshold,
        hasShortage,
      },
      latestMarks: latestMarks.map((m) => ({
        id: m.id,
        assessmentName: m.assessment.name,
        subjectCode: m.assessment.subject.code,
        subjectName: m.assessment.subject.name,
        type: m.assessment.type,
        score: m.score,
        maxMarks: m.assessment.maxMarks,
        gradeLetter: m.gradeLetter,
        isAbsent: m.isAbsent,
        date: m.createdAt,
      })),
      recentMaterials: recentMaterials.map((m) => ({
        id: m.id,
        title: m.title,
        subjectName: m.subject.name,
        unitTitle: m.unit?.title,
        type: m.type,
        allowDownload: m.allowDownload,
        createdAt: m.createdAt,
      })),
      announcements,
      unansweredDoubts,
    };
  }

  /**
   * 2. Faculty Dashboard Data Aggregator
   */
  static async getFacultyDashboard(institutionId: string, facultyId: string) {
    const communityAllowed = await PrivacyService.canUseCommunity(institutionId, facultyId);
    const schedule = await ScheduleService.getUserCalendar(institutionId, facultyId, RoleType.FACULTY);
    // A. Assigned Subjects & Sections
    const assignments = await prisma.facultyAssignment.findMany({
      where: { institutionId, facultyId },
      include: {
        subject: true,
        section: {
          include: {
            semester: true,
            enrollments: {
              where: { status: 'ACTIVE' },
              select: { id: true },
            },
          },
        },
      },
    });

    const assignedSubjectIds = Array.from(new Set(assignments.map((a) => a.subjectId)));

    // B. Pending Attendance Sessions
    const pendingAttendance = await prisma.attendanceSession.findMany({
      where: {
        institutionId,
        facultyId,
        isCompleted: false,
      },
      include: {
        subject: true,
        section: true,
      },
      orderBy: { sessionDate: 'asc' },
    });

    // C. Recent Doubts Needing Resolution
    const recentDoubts = communityAllowed ? await prisma.doubt.findMany({
      where: {
        institutionId,
        subjectId: { in: assignedSubjectIds },
        isResolved: false,
      },
      include: {
        student: {
          select: { firstName: true, lastName: true, email: true },
        },
        subject: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }) : [];

    // D. Class Performance Summary across assessments
    const assessments = await prisma.assessment.findMany({
      where: {
        institutionId,
        facultyId,
        subjectId: { in: assignedSubjectIds },
      },
      include: {
        subject: true,
        marks: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const performanceSummary = assessments.map((a) => {
      const validScores = a.marks.filter((m) => m.score !== null && !m.isAbsent).map((m) => m.score!);
      const count = validScores.length;
      const average = count > 0 ? Math.round((validScores.reduce((s, c) => s + c, 0) / count) * 10) / 10 : 0;
      const passCount = a.marks.filter((m) => m.gradeLetter !== 'F' && !m.isAbsent && m.score !== null).length;
      const passRate = a.marks.length > 0 ? Math.round((passCount / a.marks.length) * 100) : 0;

      return {
        id: a.id,
        name: a.name,
        subjectCode: a.subject.code,
        state: a.state,
        totalStudents: a.marks.length,
        average,
        maxMarks: a.maxMarks,
        passRate,
      };
    });

    // E. Announcements
    const [legacyAnnouncements, verifiedPosts] = await Promise.all([prisma.announcement.findMany({
      where: { institutionId, OR: [{ targetRole: null }, { targetRole: { in: [RoleType.FACULTY, RoleType.HOD, RoleType.CLASS_INCHARGE] } }] },
      include: {
        author: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }), communityAllowed ? CommunityService.getFeedPosts(institutionId, facultyId, { isVerifiedAnnouncement: true }) : Promise.resolve([])]);
    const announcements = [
      ...legacyAnnouncements,
      ...verifiedPosts.map((post) => ({ ...post, title: post.title || 'Verified announcement' })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

    return {
      assignedSubjects: assignments.map((a) => ({
        assignmentId: a.id,
        subjectId: a.subject.id,
        sectionId: a.section.id,
        subjectName: a.subject.name,
        subjectCode: a.subject.code,
        credits: a.subject.credits,
        sectionName: a.section.name,
        semesterName: a.section.semester.name,
        studentCount: a.section.enrollments.length,
      })),
      todayClasses: schedule.todayClasses,
      weeklyTimetable: schedule.weeklyTimetable,
      calendar: schedule.items,
      pendingAttendance: pendingAttendance.map((p) => ({
        id: p.id,
        subjectName: p.subject.name,
        subjectCode: p.subject.code,
        sectionName: p.section.name,
        date: p.sessionDate,
        period: p.periodNumber,
      })),
      recentDoubts,
      performanceSummary,
      announcements,
    };
  }

  /**
   * 3. Ask Doubt (Student)
   */
  static async askDoubt(
    institutionId: string,
    studentId: string,
    data: { subjectId: string; title: string; content: string }
  ) {
    if (!await PrivacyService.canUseCommunity(institutionId, studentId)) {
      throw new Error('Guardian consent is required before community features can be used.');
    }
    const doubt = await prisma.doubt.create({
      data: {
        institutionId,
        studentId,
        subjectId: data.subjectId,
        title: data.title,
        content: data.content,
      },
      include: {
        student: { select: { firstName: true, lastName: true } },
        subject: true,
      },
    });

    // Notify assigned faculty
    const assignments = await prisma.facultyAssignment.findMany({
      where: { institutionId, subjectId: data.subjectId },
      select: { facultyId: true },
    });
    const facultyIds = Array.from(new Set(assignments.map((a) => a.facultyId)));

    if (facultyIds.length > 0) {
      await NotificationService.createNotification(
        institutionId,
        facultyIds,
        NotificationCategory.COMMUNITY,
        `New Student Doubt: ${data.title}`,
        `${doubt.student.firstName} asked a question in ${doubt.subject.code} - ${doubt.subject.name}.`,
        '/faculty'
      );
    }

    return doubt;
  }

  /**
   * 4. Answer Doubt (Faculty)
   */
  static async answerDoubt(
    institutionId: string,
    facultyId: string,
    doubtId: string,
    reply: string
  ) {
    const doubt = await prisma.doubt.findFirst({
      where: { id: doubtId, institutionId },
      include: { subject: true },
    });

    if (!doubt) {
      throw new Error('Doubt not found');
    }

    const updated = await prisma.doubt.update({
      where: { id: doubtId },
      data: {
        reply,
        facultyId,
        isResolved: true,
        resolvedAt: new Date(),
      },
    });

    // Trigger Notification to Student (Requirement: "doubt answered")
    await NotificationService.createNotification(
      institutionId,
      [doubt.studentId],
      NotificationCategory.COMMUNITY,
      `Your Doubt was Answered: "${doubt.title}"`,
      `Your instructor replied in ${doubt.subject.code}: "${reply.slice(0, 100)}${reply.length > 100 ? '...' : ''}"`,
      '/student'
    );

    return updated;
  }

  /**
   * 5. Post Announcement (Faculty / Admin)
   */
  static async postAnnouncement(
    institutionId: string,
    authorId: string,
    data: { title: string; content: string; targetRole?: RoleType; isPinned?: boolean }
  ) {
    const announcement = await prisma.announcement.create({
      data: {
        institutionId,
        authorId,
        title: data.title,
        content: data.content,
        targetRole: data.targetRole || null,
        isPinned: data.isPinned || false,
      },
      include: {
        author: { select: { firstName: true, lastName: true, role: true } },
      },
    });

    // Find recipient users
    const whereUser: any = { institutionId, isActive: true };
    if (data.targetRole) {
      whereUser.role = data.targetRole;
    }
    const recipients = await prisma.user.findMany({
      where: whereUser,
      select: { id: true },
    });

    const userIds = recipients.map((u) => u.id);

    // Trigger Notification (Requirement: "announcement posted")
    await NotificationService.createNotification(
      institutionId,
      userIds,
      NotificationCategory.ANNOUNCEMENT,
      `Announcement: ${data.title}`,
      data.content.slice(0, 120),
      '/announcements'
    );

    return announcement;
  }
}
