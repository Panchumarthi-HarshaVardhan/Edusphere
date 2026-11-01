import { Request } from 'express';
import { prisma } from '../utils/prisma.js';
import { attendanceCredit, attendancePercentage } from '../utils/attendance.js';
import { AttendanceStatus, CorrectionStatus, RoleType, NotificationCategory } from '@prisma/client';
import { createAuditLog } from './audit.service.js';
import { NotificationService } from './notification.service.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfmake';

export class AttendanceService {
  /**
   * Faculty creates or retrieves a session for (subject, section, date, period)
   */
  static async createOrGetSession(
    institutionId: string,
    facultyId: string,
    data: {
      subjectId: string;
      sectionId: string;
      sessionDate: string;
      periodNumber: number;
      topicCovered?: string;
    }
  ) {
    const sessionDate = new Date(data.sessionDate);
    // Truncate to day for consistency
    sessionDate.setHours(0, 0, 0, 0);

    const existing = await prisma.attendanceSession.findUnique({
      where: {
        institutionId_subjectId_sectionId_sessionDate_periodNumber: {
          institutionId,
          subjectId: data.subjectId,
          sectionId: data.sectionId,
          sessionDate,
          periodNumber: data.periodNumber,
        },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
        records: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Initialize new session with enrolled students in section
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        sectionId: data.sectionId,
        status: 'ACTIVE',
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { rollNumber: 'asc' },
    });

    const newSession = await prisma.attendanceSession.create({
      data: {
        institutionId,
        subjectId: data.subjectId,
        sectionId: data.sectionId,
        facultyId,
        sessionDate,
        periodNumber: data.periodNumber,
        topicCovered: data.topicCovered || null,
        isCompleted: false, // Pending until marked
        records: {
          create: enrollments.map((e) => ({
            institutionId,
            studentId: e.studentId,
            status: AttendanceStatus.PRESENT, // default all present
          })),
        },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
        records: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    return newSession;
  }

  /**
   * Faculty submits attendance marks (Present, Absent, Late)
   * If already marked, writes changes to audit_logs with reason
   */
  static async submitAttendance(
    institutionId: string,
    sessionId: string,
    facultyId: string,
    marks: Array<{ studentId: string; status: AttendanceStatus; remarks?: string }>,
    reason?: string,
    req?: Request
  ) {
    const session = await prisma.attendanceSession.findFirst({
      where: { id: sessionId, institutionId },
      include: { records: true },
    });

    if (!session) {
      throw { status: 404, message: 'Attendance session not found' };
    }

    const wasAlreadyCompleted = session.isCompleted;
    const oldRecordsMap = new Map(session.records.map((r) => [r.studentId, r]));
    const changesAudit: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of marks) {
        const oldRecord = oldRecordsMap.get(item.studentId);

        if (oldRecord) {
          if (oldRecord.status !== item.status) {
            changesAudit.push({
              studentId: item.studentId,
              oldStatus: oldRecord.status,
              newStatus: item.status,
            });

            await tx.attendanceRecord.update({
              where: { id: oldRecord.id },
              data: {
                status: item.status,
                remarks: item.remarks || null,
              },
            });
          }
        } else {
          await tx.attendanceRecord.create({
            data: {
              institutionId,
              attendanceSessionId: sessionId,
              studentId: item.studentId,
              status: item.status,
              remarks: item.remarks || null,
            },
          });
        }
      }

      await tx.attendanceSession.update({
        where: { id: sessionId },
        data: { isCompleted: true },
      });
    });

    // Write to audit log if editing past completed attendance
    if (wasAlreadyCompleted && changesAudit.length > 0) {
      await createAuditLog({
        institutionId,
        userId: facultyId,
        action: 'ATTENDANCE_EDIT_PAST',
        resource: 'attendance_session',
        resourceId: sessionId,
        details: {
          reason: reason || 'Faculty adjusted attendance records',
          changes: changesAudit,
        },
        req,
      });
    }

    // Trigger shortage detection & unmutable alerts (Rule 6)
    try {
      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: { defaultAttendanceThreshold: true },
      });
      const threshold = institution?.defaultAttendanceThreshold || 75.0;

      const nonPresentStudentIds = marks
        .filter((m) => m.status === AttendanceStatus.ABSENT || m.status === AttendanceStatus.LATE)
        .map((m) => m.studentId);

      for (const stId of nonPresentStudentIds) {
        const studentRecords = await prisma.attendanceRecord.findMany({
          where: { institutionId, studentId: stId },
        });
        const total = studentRecords.length;
        if (total > 0) {
          const present = studentRecords.filter((r) => r.status === AttendanceStatus.PRESENT).length;
          const late = studentRecords.filter((r) => r.status === AttendanceStatus.LATE).length;
          const pct = Math.round(((present + late * 0.5) / total) * 1000) / 10;
          if (pct < threshold) {
            await NotificationService.createNotification(
              institutionId,
              [stId],
              NotificationCategory.ATTENDANCE,
              'Mandatory Attendance Shortage Alert',
              `Your overall attendance is currently ${pct}%, which is below the mandatory institutional threshold of ${threshold}%. Please consult your course instructor.`,
              '/student'
            );
          }
        }
      }
    } catch (notifErr) {
      console.error('[Shortage Alert Error] Notification delivery failed.');
    }

    return {
      message: 'Attendance saved successfully',
      recordsUpdated: marks.length,
      auditChangesLogged: changesAudit.length,
    };
  }

  /**
   * Pending attendance sessions for faculty dashboard widget
   */
  static async getPendingSessions(institutionId: string, facultyId: string) {
    return prisma.attendanceSession.findMany({
      where: {
        institutionId,
        facultyId,
        isCompleted: false,
      },
      orderBy: { sessionDate: 'desc' },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
        _count: { select: { records: true } },
      },
    });
  }

  /**
   * Student aggregate attendance: Subject-wise conducted vs attended vs missed
   * Computed purely via SQL aggregation from attendance_records (Rule 3)
   */
  static async getStudentAggregate(institutionId: string, studentId: string) {
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { defaultAttendanceThreshold: true },
    });
    const threshold = institution?.defaultAttendanceThreshold || 75.0;

    // Fetch all records with subject information
    const records = await prisma.attendanceRecord.findMany({
      where: {
        institutionId,
        studentId,
        session: { isCompleted: true },
      },
      include: {
        session: {
          include: {
            subject: { select: { id: true, name: true, code: true, credits: true } },
          },
        },
      },
      orderBy: { session: { sessionDate: 'asc' } },
    });

    // Subject-wise grouping
    const subjectMap = new Map<string, {
      subject: { id: string; name: string; code: string; credits: number };
      totalConducted: number;
      attended: number;
      attendanceCredits: number;
      late: number;
      missed: number;
      records: Array<{
        date: string;
        period: number;
        status: AttendanceStatus;
        recordId: string;
      }>;
    }>();

    for (const rec of records) {
      const sub = rec.session.subject;
      if (!subjectMap.has(sub.id)) {
        subjectMap.set(sub.id, {
          subject: sub,
          totalConducted: 0,
          attended: 0,
          attendanceCredits: 0,
          late: 0,
          missed: 0,
          records: [],
        });
      }

      const item = subjectMap.get(sub.id)!;
      item.totalConducted += 1;
      if (rec.status === AttendanceStatus.PRESENT) {
        item.attended += 1;
      } else if (rec.status === AttendanceStatus.LATE) {
        item.late += 1;
        item.attended += 1;
      } else {
        item.missed += 1;
      }
      item.attendanceCredits += attendanceCredit(rec.status);

      item.records.push({
        date: rec.session.sessionDate.toISOString(),
        period: rec.session.periodNumber,
        status: rec.status,
        recordId: rec.id,
      });
    }

    const subjectMetrics = Array.from(subjectMap.values()).map((s) => {
      const percentage = attendancePercentage(s.totalConducted, s.attendanceCredits);
      
      const isShortage = percentage < threshold;

      // What-if calculation: Consecutive classes needed to reach threshold %
      // (attended + X) / (totalConducted + X) >= threshold / 100
      // X = ceil((threshold * totalConducted - 100 * attended) / (100 - threshold))
      let neededToReachThreshold = 0;
      if (percentage < threshold && threshold < 100) {
        const numerator = (threshold * s.totalConducted) - (100 * s.attendanceCredits);
        const denominator = 100 - threshold;
        neededToReachThreshold = Math.max(0, Math.ceil(numerator / denominator));
      }

      // Max classes student can safely skip while staying >= threshold %
      // attended / (totalConducted + Y) >= threshold / 100
      // Y = floor((100 * attended - threshold * totalConducted) / threshold)
      let canAffordToMiss = 0;
      if (percentage >= threshold && threshold > 0) {
        const numerator = (100 * s.attendanceCredits) - (threshold * s.totalConducted);
        canAffordToMiss = Math.max(0, Math.floor(numerator / threshold));
      }

      return {
        ...s,
        percentage,
        isShortage,
        threshold,
        neededToReachThreshold,
        canAffordToMiss,
      };
    });

    const totalConductedAll = subjectMetrics.reduce((acc, curr) => acc + curr.totalConducted, 0);
    const totalAttendedAll = subjectMetrics.reduce((acc, curr) => acc + curr.attended, 0);
    const totalAttendanceCredits = subjectMetrics.reduce((acc, curr) => acc + curr.attendanceCredits, 0);
    const overallPercentage = attendancePercentage(totalConductedAll, totalAttendanceCredits);

    return {
      overallPercentage,
      totalConducted: totalConductedAll,
      totalAttended: totalAttendedAll,
      attendanceCredits: totalAttendanceCredits,
      threshold,
      hasShortage: overallPercentage < threshold,
      subjectMetrics,
    };
  }

  /**
   * Student submits correction request
   */
  static async requestCorrection(
    institutionId: string,
    studentId: string,
    attendanceRecordId: string,
    requestedStatus: AttendanceStatus,
    reason: string
  ) {
    const record = await prisma.attendanceRecord.findFirst({
      where: { id: attendanceRecordId, institutionId, studentId },
    });

    if (!record) {
      throw { status: 404, message: 'Attendance record not found or unauthorized' };
    }

    return prisma.attendanceCorrectionRequest.create({
      data: {
        institutionId,
        attendanceRecordId,
        studentId,
        requestedStatus,
        reason,
        status: CorrectionStatus.PENDING,
      },
    });
  }

  /**
   * Faculty reviews correction request (Approve/Reject) with audit trail
   */
  static async reviewCorrection(
    institutionId: string,
    facultyId: string,
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewRemarks?: string,
    req?: Request
  ) {
    const request = await prisma.attendanceCorrectionRequest.findFirst({
      where: { id: requestId, institutionId },
      include: { record: true },
    });

    if (!request) {
      throw { status: 404, message: 'Correction request not found' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.attendanceCorrectionRequest.update({
        where: { id: requestId },
        data: {
          status: decision === 'APPROVED' ? CorrectionStatus.APPROVED : CorrectionStatus.REJECTED,
          reviewedById: facultyId,
          reviewRemarks: reviewRemarks || null,
        },
      });

      if (decision === 'APPROVED') {
        const oldStatus = request.record.status;
        await tx.attendanceRecord.update({
          where: { id: request.attendanceRecordId },
          data: { status: request.requestedStatus },
        });

        await createAuditLog({
          institutionId,
          userId: facultyId,
          action: 'ATTENDANCE_CORRECTION_APPROVED',
          resource: 'attendance_record',
          resourceId: request.attendanceRecordId,
          details: {
            requestId: request.id,
            oldStatus,
            newStatus: request.requestedStatus,
            studentId: request.studentId,
            reason: request.reason,
          },
          req,
        });
      }
    });

    return { message: `Correction request ${decision.toLowerCase()} successfully` };
  }

  /**
   * Monthly Attendance Report Data per subject & section
   */
  static async getMonthlyReportData(
    institutionId: string,
    subjectId: string,
    sectionId: string,
    year: number,
    month: number // 1 to 12
  ) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const [sessions, students] = await Promise.all([
      prisma.attendanceSession.findMany({
        where: {
          institutionId,
          subjectId,
          sectionId,
          sessionDate: { gte: startDate, lte: endDate },
          isCompleted: true,
        },
        orderBy: [{ sessionDate: 'asc' }, { periodNumber: 'asc' }],
        include: { records: true },
      }),
      prisma.studentEnrollment.findMany({
        where: { institutionId, sectionId, status: 'ACTIVE' },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { rollNumber: 'asc' },
      }),
    ]);

    const reportRows = students.map((enrollment) => {
      let attended = 0;
      let attendanceCredits = 0;
      let late = 0;
      let absent = 0;

      const sessionAttendance: Record<string, AttendanceStatus | 'NA'> = {};

      sessions.forEach((sess) => {
        const rec = sess.records.find((r) => r.studentId === enrollment.studentId);
        const status = rec?.status || 'NA';
        sessionAttendance[`${sess.sessionDate.toISOString().slice(0, 10)}_P${sess.periodNumber}`] = status;

        if (status === AttendanceStatus.PRESENT) { attended += 1; attendanceCredits += attendanceCredit(status); }
        else if (status === AttendanceStatus.LATE) {
          late += 1;
          attended += 1;
          attendanceCredits += attendanceCredit(status);
        } else if (status === AttendanceStatus.ABSENT) absent += 1;
      });

      const total = sessions.length;
      const percentage = attendancePercentage(total, attendanceCredits);

      return {
        rollNumber: enrollment.rollNumber,
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        email: enrollment.student.email,
        attended,
        attendanceCredits,
        late,
        absent,
        total,
        percentage,
        sessionAttendance,
      };
    });

    return {
      year,
      month,
      totalSessions: sessions.length,
      sessions: sessions.map((s) => ({
        id: s.id,
        date: s.sessionDate.toISOString().slice(0, 10),
        period: s.periodNumber,
      })),
      students: reportRows,
    };
  }

  /**
   * Export Monthly Attendance to Excel workbook buffer
   */
  static async exportMonthlyExcel(
    institutionId: string,
    subjectId: string,
    sectionId: string,
    year: number,
    month: number
  ) {
    const data = await this.getMonthlyReportData(institutionId, subjectId, sectionId, year, month);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Attendance_${month}_${year}`);

    // Headers
    const sessionCols = data.sessions.map((s) => ({
      header: `${s.date} (P${s.period})`,
      key: `${s.date}_P${s.period}`,
      width: 14,
    }));

    sheet.columns = [
      { header: 'Roll No', key: 'rollNumber', width: 14 },
      { header: 'Student Name', key: 'studentName', width: 24 },
      { header: 'Total Sessions', key: 'total', width: 14 },
      { header: 'Attended', key: 'attended', width: 12 },
      { header: 'Absent', key: 'absent', width: 10 },
      { header: 'Attendance %', key: 'percentage', width: 14 },
      ...sessionCols,
    ];

    // Rows
    data.students.forEach((s) => {
      sheet.addRow({
        rollNumber: s.rollNumber,
        studentName: s.studentName,
        total: s.total,
        attended: s.attended,
        absent: s.absent,
        percentage: `${s.percentage}%`,
        ...s.sessionAttendance,
      });
    });

    return workbook.xlsx.writeBuffer();
  }
}
