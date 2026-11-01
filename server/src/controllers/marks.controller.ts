import { Request, Response, NextFunction } from 'express';
import { MarksService } from '../services/marks.service.js';
import { AssessmentType, PublicationState, RoleType } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

export class MarksController {
  static async createAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const facultyId = req.user!.userId;
      const { subjectId, sectionId, name, type, maxMarks, weightage } = req.body;

      const assessment = await MarksService.createAssessment(
        institutionId,
        facultyId,
        {
          subjectId,
          sectionId,
          name,
          type: type as AssessmentType,
          maxMarks: parseFloat(maxMarks),
          weightage: weightage ? parseFloat(weightage) : 1.0,
        },
        req
      );

      res.status(201).json({ message: 'Assessment created successfully', assessment });
    } catch (error) {
      next(error);
    }
  }

  static async listAssessments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const { subjectId, sectionId } = req.query;
      const role = req.user!.role;
      const assignmentFilter = role === RoleType.FACULTY || role === RoleType.CLASS_INCHARGE || role === RoleType.HOD
        ? await prisma.facultyAssignment.findMany({
            where: { institutionId, facultyId: req.user!.userId },
            select: { subjectId: true, sectionId: true },
          })
        : null;

      const assessments = await prisma.assessment.findMany({
        where: {
          institutionId,
          ...(subjectId && { subjectId: String(subjectId) }),
          ...(sectionId && { sectionId: String(sectionId) }),
          ...(assignmentFilter && { OR: assignmentFilter.map((item) => ({ subjectId: item.subjectId, sectionId: item.sectionId })) }),
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          section: { select: { id: true, name: true } },
          _count: { select: { marks: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({ assessments });
    } catch (error) {
      next(error);
    }
  }

  static async getAssessmentDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const assessmentId = req.params.assessmentId;

      const assessment = await prisma.assessment.findFirst({
        where: { id: assessmentId, institutionId },
        include: {
          subject: true,
          section: true,
          marks: {
            include: {
              student: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
            orderBy: { student: { lastName: 'asc' } },
          },
        },
      });

      if (!assessment) {
        res.status(404).json({ message: 'Assessment not found' });
        return;
      }

      res.status(200).json({ assessment });
    } catch (error) {
      next(error);
    }
  }

  static async saveMarks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const facultyId = req.user!.userId;
      const assessmentId = req.params.assessmentId;
      const { entries, reason } = req.body;

      const result = await MarksService.saveMarks(
        institutionId,
        assessmentId,
        facultyId,
        entries,
        reason,
        req
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async updatePublication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const facultyId = req.user!.userId;
      const assessmentId = req.params.assessmentId;
      const { state } = req.body;

      const assessment = await MarksService.setPublicationState(
        institutionId,
        assessmentId,
        facultyId,
        state as PublicationState,
        req
      );

      res.status(200).json({ message: `Marks ${state.toLowerCase()} successfully`, assessment });
    } catch (error) {
      next(error);
    }
  }

  static async getClassStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const assessmentId = req.params.assessmentId;

      const stats = await MarksService.getClassStats(institutionId, assessmentId);
      res.status(200).json({ stats });
    } catch (error) {
      next(error);
    }
  }

  static async uploadExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const facultyId = req.user!.userId;
      const assessmentId = req.params.assessmentId;
      const reason = req.body.reason;
      const file = req.file;

      if (!file) {
        res.status(400).json({ message: 'Excel file required' });
        return;
      }

      const result = await MarksService.uploadMarksExcel(
        institutionId,
        assessmentId,
        facultyId,
        file.buffer,
        reason,
        req
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getStudentMarks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const canViewAnotherStudent = req.user!.role === RoleType.ADMIN || req.user!.role === RoleType.SUPER_ADMIN;
      const studentId = canViewAnotherStudent && req.query.studentId
        ? String(req.query.studentId)
        : req.user!.userId;

      const report = await MarksService.getStudentMarks(institutionId, studentId);
      res.status(200).json(report);
    } catch (error) {
      next(error);
    }
  }

  static async requestCorrection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const institutionId = req.institutionId!;
      const studentId = req.user!.userId;
      const { studentMarkId, claimedScore, reason } = req.body;

      const request = await MarksService.requestMarkCorrection(
        institutionId,
        studentId,
        studentMarkId,
        parseFloat(claimedScore),
        reason
      );

      res.status(201).json({ message: 'Mark correction request submitted', request });
    } catch (error) {
      next(error);
    }
  }
}
