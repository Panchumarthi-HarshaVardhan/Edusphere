import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service.js';

export class DashboardController {
  static async getStudentDashboard(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const studentId = req.user!.userId;

      const data = await DashboardService.getStudentDashboard(institutionId, studentId);
      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to fetch student dashboard' });
    }
  }

  static async getFacultyDashboard(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const facultyId = req.user!.userId;

      const data = await DashboardService.getFacultyDashboard(institutionId, facultyId);
      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to fetch faculty dashboard' });
    }
  }

  static async askDoubt(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const studentId = req.user!.userId;
      const { subjectId, title, content } = req.body;

      if (!subjectId || !title || !content) {
        return res.status(400).json({ message: 'subjectId, title, and content are required' });
      }

      const doubt = await DashboardService.askDoubt(institutionId, studentId, {
        subjectId,
        title,
        content,
      });

      return res.status(201).json({ message: 'Doubt submitted successfully', doubt });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to submit doubt' });
    }
  }

  static async answerDoubt(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const facultyId = req.user!.userId;
      const { id } = req.params;
      const { reply } = req.body;

      if (!reply) {
        return res.status(400).json({ message: 'reply text is required' });
      }

      const doubt = await DashboardService.answerDoubt(institutionId, facultyId, id, reply);
      return res.status(200).json({ message: 'Doubt answered successfully', doubt });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to answer doubt' });
    }
  }

  static async postAnnouncement(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const authorId = req.user!.userId;
      const { title, content, targetRole, isPinned } = req.body;

      if (!title || !content) {
        return res.status(400).json({ message: 'title and content are required' });
      }

      const announcement = await DashboardService.postAnnouncement(
        institutionId,
        authorId,
        {
          title,
          content,
          targetRole,
          isPinned,
        }
      );

      return res.status(201).json({ message: 'Announcement posted successfully', announcement });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to post announcement' });
    }
  }
}
