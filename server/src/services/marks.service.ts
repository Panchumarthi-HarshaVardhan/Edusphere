import { Request } from 'express';
import { prisma } from '../utils/prisma.js';
import { AssessmentType, PublicationState, CorrectionStatus, RoleType, NotificationCategory } from '@prisma/client';
import { createAuditLog } from './audit.service.js';
import { NotificationService } from './notification.service.js';
import ExcelJS from 'exceljs';

export class MarksService {
  /**
   * Seed or ensure standard institutional grade rules exist
   */
  static async ensureDefaultGradeRules(institutionId: string) {
    const existing = await prisma.gradeRule.findFirst({ where: { institutionId } });
    if (!existing) {
      const defaultRules = [
        { gradeLetter: 'O', gradePoint: 10.0, minPercentage: 90.0, maxPercentage: 100.0, isPass: true },
        { gradeLetter: 'A+', gradePoint: 9.0, minPercentage: 80.0, maxPercentage: 89.9, isPass: true },
        { gradeLetter: 'A', gradePoint: 8.0, minPercentage: 70.0, maxPercentage: 79.9, isPass: true },
        { gradeLetter: 'B+', gradePoint: 7.0, minPercentage: 60.0, maxPercentage: 69.9, isPass: true },
        { gradeLetter: 'B', gradePoint: 6.0, minPercentage: 50.0, maxPercentage: 59.9, isPass: true },
        { gradeLetter: 'C', gradePoint: 5.0, minPercentage: 40.0, maxPercentage: 49.9, isPass: true },
        { gradeLetter: 'F', gradePoint: 0.0, minPercentage: 0.0, maxPercentage: 39.9, isPass: false },
      ];

      for (const rule of defaultRules) {
        await prisma.gradeRule.create({
          data: { institutionId, ...rule },
        });
      }
    }
  }

  /**
   * Determine grade letter from percentage using institutional grade rules
   */
  static async calculateGrade(institutionId: string, percentage: number): Promise<string> {
    const rules = await prisma.gradeRule.findMany({
      where: { institutionId },
      orderBy: { minPercentage: 'desc' },
    });

    for (const r of rules) {
      if (percentage >= r.minPercentage && percentage <= r.maxPercentage) {
        return r.gradeLetter;
      }
    }
    return percentage >= 40 ? 'Pass' : 'F';
  }

  /**
   * Create an Assessment definition (Internal 1, Assignment, Lab, External, etc.)
   */
  static async createAssessment(
    institutionId: string,
    facultyId: string,
    data: {
      subjectId: string;
      sectionId: string;
      name: string;
      type: AssessmentType;
      maxMarks: number;
      weightage?: number;
    },
    req?: Request
  ) {
    await this.ensureDefaultGradeRules(institutionId);

    // Initialize assessment with active student enrollments
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { institutionId, sectionId: data.sectionId, status: 'ACTIVE' },
      orderBy: { rollNumber: 'asc' },
    });

    const assessment = await prisma.assessment.create({
      data: {
        institutionId,
        subjectId: data.subjectId,
        sectionId: data.sectionId,
        facultyId,
        name: data.name,
        type: data.type,
        maxMarks: data.maxMarks,
        weightage: data.weightage || 1.0,
        state: PublicationState.DRAFT,
        marks: {
          create: enrollments.map((e) => ({
            institutionId,
            studentId: e.studentId,
            score: null,
            gradeLetter: null,
            isAbsent: false,
          })),
        },
      },
      include: {
        marks: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      institutionId,
      userId: facultyId,
      action: 'ASSESSMENT_CREATED',
      resource: 'assessment',
      resourceId: assessment.id,
      details: { name: data.name, type: data.type, maxMarks: data.maxMarks },
      req,
    });

    return assessment;
  }

  /**
   * Enter or bulk update marks in grid.
   * If published, requires authorized edit reason and writes to audit_logs (Rule 4)
   */
  static async saveMarks(
    institutionId: string,
    assessmentId: string,
    facultyId: string,
    entries: Array<{
      studentId: string;
      score: number | null;
      isAbsent?: boolean;
      remarks?: string;
    }>,
    reason?: string,
    req?: Request
  ) {
    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, institutionId },
      include: { marks: true },
    });

    if (!assessment) {
      throw { status: 404, message: 'Assessment not found' };
    }

    // Validate scores do not exceed maxMarks
    for (const item of entries) {
      if (item.score !== null && item.score !== undefined) {
        if (item.score < 0 || item.score > assessment.maxMarks) {
          throw {
            status: 400,
            message: `Score ${item.score} is invalid. Must be between 0 and maximum marks (${assessment.maxMarks}).`,
          };
        }
      }
    }

    const isPublished = assessment.state === PublicationState.PUBLISHED;
    if (isPublished && !reason?.trim()) {
      throw {
        status: 400,
        message: 'Non-negotiable Rule 4: Edits to published marks require an authorized reason.',
      };
    }

    const oldMarksMap = new Map(assessment.marks.map((m) => [m.studentId, m]));
    const auditChanges: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of entries) {
        const oldMark = oldMarksMap.get(item.studentId);
        let gradeLetter: string | null = null;

        if (item.score !== null && !item.isAbsent) {
          const pct = (item.score / assessment.maxMarks) * 100;
          gradeLetter = await this.calculateGrade(institutionId, pct);
        } else if (item.isAbsent) {
          gradeLetter = 'AB';
        }

        if (oldMark) {
          if (oldMark.score !== item.score || oldMark.isAbsent !== item.isAbsent) {
            auditChanges.push({
              studentId: item.studentId,
              oldScore: oldMark.score,
              newScore: item.score,
              oldAbsent: oldMark.isAbsent,
              newAbsent: item.isAbsent,
            });

            await tx.studentMark.update({
              where: { id: oldMark.id },
              data: {
                score: item.isAbsent ? null : item.score,
                gradeLetter,
                isAbsent: item.isAbsent || false,
                remarks: item.remarks || null,
              },
            });
          }
        } else {
          await tx.studentMark.create({
            data: {
              institutionId,
              assessmentId,
              studentId: item.studentId,
              score: item.isAbsent ? null : item.score,
              gradeLetter,
              isAbsent: item.isAbsent || false,
              remarks: item.remarks || null,
            },
          });
        }
      }
    });

    // Write audit log if published
    if (isPublished && auditChanges.length > 0) {
      await createAuditLog({
        institutionId,
        userId: facultyId,
        action: 'PUBLISHED_MARKS_EDITED',
        resource: 'assessment',
        resourceId: assessmentId,
        details: {
          reason,
          changes: auditChanges,
        },
        req,
      });

      // Trigger notification to affected students
      const changedStudentIds = auditChanges.map((c) => c.studentId);
      if (changedStudentIds.length > 0) {
        await NotificationService.createNotification(
          institutionId,
          changedStudentIds,
          NotificationCategory.EXAM,
          `Score Updated: ${assessment.name}`,
          `An authorized grade modification was recorded for ${assessment.name}. Reason: ${reason}`,
          '/student'
        );
      }
    }

    return {
      message: 'Marks updated successfully',
      recordsUpdated: entries.length,
      auditLogged: isPublished,
    };
  }

  /**
   * Toggle publication state (Draft vs Published)
   */
  static async setPublicationState(
    institutionId: string,
    assessmentId: string,
    facultyId: string,
    state: PublicationState,
    req?: Request
  ) {
    const assessment = await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        state,
        publishedAt: state === PublicationState.PUBLISHED ? new Date() : null,
      },
      include: {
        subject: true,
      },
    });

    await createAuditLog({
      institutionId,
      userId: facultyId,
      action: state === PublicationState.PUBLISHED ? 'MARKS_PUBLISHED' : 'MARKS_UNPUBLISHED',
      resource: 'assessment',
      resourceId: assessmentId,
      details: { state },
      req,
    });

    // Trigger Notification when marks are published (Rule 5 & Requirement: "marks published")
    if (state === PublicationState.PUBLISHED) {
      const studentMarks = await prisma.studentMark.findMany({
        where: { assessmentId },
        select: { studentId: true },
      });
      const studentIds = studentMarks.map((m) => m.studentId);
      if (studentIds.length > 0) {
        await NotificationService.createNotification(
          institutionId,
          studentIds,
          NotificationCategory.EXAM,
          `Marks Published: ${assessment.name}`,
          `Your grades for ${assessment.name} (${assessment.subject.code}) are now published. Check your Academic Report.`,
          '/student'
        );
      }
    }

    return assessment;
  }

  /**
   * Class stats: Average, highest, pass percentage
   */
  static async getClassStats(institutionId: string, assessmentId: string) {
    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, institutionId },
      include: {
        marks: {
          include: { student: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!assessment) {
      throw { status: 404, message: 'Assessment not found' };
    }

    const scoredMarks = assessment.marks.filter((m) => m.score !== null && !m.isAbsent);
    const totalAppeared = scoredMarks.length;

    if (totalAppeared === 0) {
      return {
        totalStudents: assessment.marks.length,
        totalAppeared: 0,
        average: 0,
        highest: 0,
        lowest: 0,
        passPercentage: 0,
      };
    }

    const scores = scoredMarks.map((m) => m.score as number);
    const totalSum = scores.reduce((a, b) => a + b, 0);
    const average = Math.round((totalSum / totalAppeared) * 10) / 10;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);

    // Pass threshold is 40% of maxMarks
    const passThreshold = assessment.maxMarks * 0.4;
    const passedCount = scores.filter((s) => s >= passThreshold).length;
    const passPercentage = Math.round((passedCount / totalAppeared) * 1000) / 10;

    return {
      totalStudents: assessment.marks.length,
      totalAppeared,
      absentCount: assessment.marks.filter((m) => m.isAbsent).length,
      average,
      highest,
      lowest,
      passPercentage,
    };
  }

  /**
   * Bulk marks upload from Excel spreadsheet
   */
  static async uploadMarksExcel(
    institutionId: string,
    assessmentId: string,
    facultyId: string,
    fileBuffer: Buffer,
    reason?: string,
    req?: Request
  ) {
    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, institutionId },
    });

    if (!assessment) {
      throw { status: 404, message: 'Assessment not found' };
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);
    const worksheet = workbook.worksheets[0];

    const entries: Array<{ studentId: string; score: number | null; isAbsent: boolean }> = [];
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { institutionId, sectionId: assessment.sectionId },
      include: { student: true },
    });
    const rollToStudentMap = new Map(enrollments.map((e) => [e.rollNumber.trim().toUpperCase(), e.studentId]));

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip headers
      const roll = row.getCell(1).text.trim().toUpperCase();
      const scoreRaw = row.getCell(3).value;
      const isAbsentStr = row.getCell(4).text.trim().toUpperCase();

      const studentId = rollToStudentMap.get(roll);
      if (studentId) {
        const isAbsent = isAbsentStr === 'YES' || isAbsentStr === 'TRUE' || isAbsentStr === 'AB';
        const score = isAbsent ? null : typeof scoreRaw === 'number' ? scoreRaw : parseFloat(String(scoreRaw));
        entries.push({
          studentId,
          score: isNaN(score as number) ? null : score,
          isAbsent,
        });
      }
    });

    return this.saveMarks(institutionId, assessmentId, facultyId, entries, reason, req);
  }

  /**
   * Student Gradebook & Marks view (Rule 5: Only published marks)
   * Also computes SGPA/CGPA where applicable
   */
  static async getStudentMarks(institutionId: string, studentId: string) {
    const marks = await prisma.studentMark.findMany({
      where: {
        institutionId,
        studentId,
        assessment: { state: PublicationState.PUBLISHED }, // Only published marks visible to students
      },
      include: {
        assessment: {
          include: {
            subject: { select: { id: true, name: true, code: true, credits: true } },
          },
        },
      },
      orderBy: { assessment: { createdAt: 'desc' } },
    });

    // Subject-wise grouping
    const subjectMap = new Map<string, {
      subject: { id: string; name: string; code: string; credits: number };
      assessments: Array<{
        assessmentId: string;
        name: string;
        type: AssessmentType;
        score: number | null;
        maxMarks: number;
        gradeLetter: string | null;
        isAbsent: boolean;
        markId: string;
      }>;
      totalEarned: number;
      totalPossible: number;
    }>();

    for (const m of marks) {
      const sub = m.assessment.subject;
      if (!subjectMap.has(sub.id)) {
        subjectMap.set(sub.id, {
          subject: sub,
          assessments: [],
          totalEarned: 0,
          totalPossible: 0,
        });
      }

      const entry = subjectMap.get(sub.id)!;
      entry.assessments.push({
        assessmentId: m.assessment.id,
        name: m.assessment.name,
        type: m.assessment.type,
        score: m.score,
        maxMarks: m.assessment.maxMarks,
        gradeLetter: m.gradeLetter,
        isAbsent: m.isAbsent,
        markId: m.id,
      });

      if (m.score !== null && !m.isAbsent) {
        entry.totalEarned += m.score;
      }
      entry.totalPossible += m.assessment.maxMarks;
    }

    // SGPA Computation: Sum(credits * gradePoint) / Sum(credits)
    const gradeRules = await prisma.gradeRule.findMany({ where: { institutionId } });
    const gradePointMap = new Map(gradeRules.map((r) => [r.gradeLetter, r.gradePoint]));

    let totalQualityPoints = 0;
    let totalCredits = 0;

    const subjectsSummary = Array.from(subjectMap.values()).map((s) => {
      const subjectPct = s.totalPossible > 0 ? (s.totalEarned / s.totalPossible) * 100 : 0;
      let finalGrade = 'F';
      let gradePoint = 0;

      for (const gr of gradeRules) {
        if (subjectPct >= gr.minPercentage && subjectPct <= gr.maxPercentage) {
          finalGrade = gr.gradeLetter;
          gradePoint = gr.gradePoint;
          break;
        }
      }

      totalQualityPoints += s.subject.credits * gradePoint;
      totalCredits += s.subject.credits;

      return {
        ...s,
        subjectPercentage: Math.round(subjectPct * 10) / 10,
        finalGrade,
        gradePoint,
      };
    });

    const sgpa = totalCredits > 0 ? Math.round((totalQualityPoints / totalCredits) * 100) / 100 : 0.0;

    return {
      sgpa,
      totalCredits,
      subjectsSummary,
    };
  }

  /**
   * Student requests mark review / correction
   */
  static async requestMarkCorrection(
    institutionId: string,
    studentId: string,
    studentMarkId: string,
    claimedScore: number,
    reason: string
  ) {
    const mark = await prisma.studentMark.findFirst({
      where: { id: studentMarkId, institutionId, studentId },
    });

    if (!mark) {
      throw { status: 404, message: 'Student mark record not found' };
    }

    return prisma.markCorrectionRequest.create({
      data: {
        institutionId,
        studentMarkId,
        studentId,
        claimedScore,
        reason,
        status: CorrectionStatus.PENDING,
      },
    });
  }
}
