import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../services/attendance.service.js';
import { AttendanceStatus, RoleType } from '@prisma/client';

export class AttendanceController {
  static async createOrGetSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const facultyId = req.user!.userId;
      const { subjectId, sectionId, sessionDate, periodNumber, topicCovered } = req.body;

      const session = await AttendanceService.createOrGetSession(
        institutionId,
        facultyId,
        {
          subjectId,
          sectionId,
          sessionDate,
          periodNumber: parseInt(periodNumber, 10) || 1,
          topicCovered,
        }
      );

      res.status(200).json({ session });
    } catch (error) {
      next(error);
    }
  }

  static async submitAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const facultyId = req.user!.userId;
      const sessionId = req.params.sessionId;
      const { marks, reason } = req.body;

      const result = await AttendanceService.submitAttendance(
        institutionId,
        sessionId,
        facultyId,
        marks,
        reason,
        req
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getPendingSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const facultyId = req.user!.userId;

      const sessions = await AttendanceService.getPendingSessions(institutionId, facultyId);
      res.status(200).json({ sessions });
    } catch (error) {
      next(error);
    }
  }

  static async getStudentAggregate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const canViewAnotherStudent = req.user!.role === RoleType.ADMIN || req.user!.role === RoleType.SUPER_ADMIN;
      const studentId = canViewAnotherStudent && req.query.studentId
        ? (req.query.studentId as string)
        : req.user!.userId;

      const aggregate = await AttendanceService.getStudentAggregate(institutionId, studentId);
      res.status(200).json(aggregate);
    } catch (error) {
      next(error);
    }
  }

  static async requestCorrection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const studentId = req.user!.userId;
      const { attendanceRecordId, requestedStatus, reason } = req.body;

      const correction = await AttendanceService.requestCorrection(
        institutionId,
        studentId,
        attendanceRecordId,
        requestedStatus as AttendanceStatus,
        reason
      );

      res.status(201).json({ message: 'Correction request submitted', correction });
    } catch (error) {
      next(error);
    }
  }

  static async reviewCorrection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const facultyId = req.user!.userId;
      const requestId = req.params.requestId;
      const { decision, reviewRemarks } = req.body;

      const result = await AttendanceService.reviewCorrection(
        institutionId,
        facultyId,
        requestId,
        decision,
        reviewRemarks,
        req
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getMonthlyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const { subjectId, sectionId, year, month } = req.query;

      const data = await AttendanceService.getMonthlyReportData(
        institutionId,
        subjectId as string,
        sectionId as string,
        parseInt(year as string, 10) || new Date().getFullYear(),
        parseInt(month as string, 10) || new Date().getMonth() + 1
      );

      res.status(200).json({ report: data });
    } catch (error) {
      next(error);
    }
  }

  static async exportMonthlyExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const { subjectId, sectionId, year, month } = req.query;

      const buffer = await AttendanceService.exportMonthlyExcel(
        institutionId,
        subjectId as string,
        sectionId as string,
        parseInt(year as string, 10) || new Date().getFullYear(),
        parseInt(month as string, 10) || new Date().getMonth() + 1
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="attendance_report.xlsx"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}
