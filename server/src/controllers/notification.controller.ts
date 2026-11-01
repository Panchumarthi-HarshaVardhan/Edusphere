import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service.js';

export class NotificationController {
  static async getNotifications(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 30;

      const result = await NotificationService.getUserNotifications(
        institutionId,
        userId,
        unreadOnly,
        limit
      );

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to fetch notifications' });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const { id } = req.params;

      await NotificationService.markAsRead(institutionId, userId, id);
      return res.status(200).json({ message: 'Notification marked as read' });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to update notification' });
    }
  }

  static async markAllAsRead(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;

      await NotificationService.markAllAsRead(institutionId, userId);
      return res.status(200).json({ message: 'All notifications marked as read' });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to update notifications' });
    }
  }

  static async getPreferences(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;

      const preferences = await NotificationService.getUserPreferences(institutionId, userId);
      return res.status(200).json({ preferences });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to fetch preferences' });
    }
  }

  static async updatePreferences(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const userId = req.user!.userId;
      const { preferences } = req.body;

      if (!Array.isArray(preferences)) {
        return res.status(400).json({ message: 'preferences array is required' });
      }

      const updated = await NotificationService.updateUserPreferences(
        institutionId,
        userId,
        preferences
      );

      return res.status(200).json({
        message: 'Notification preferences updated successfully',
        preferences: updated,
      });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to update preferences' });
    }
  }

  static async triggerEmailQueueWorker(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const result = await NotificationService.processEmailQueue(institutionId);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || 'Failed to process email queue' });
    }
  }

  static async getEmailQueueHealth(req: Request, res: Response) {
    try {
      const stats = await NotificationService.getEmailQueueHealth(req.institutionId!);
      return res.status(200).json({ status: stats.failedJobs > 0 ? 'degraded' : 'ok', ...stats });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || 'Failed to fetch email queue health' });
    }
  }
}
