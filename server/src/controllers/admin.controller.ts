import { Request, Response } from 'express';
import { AdminService } from '../services/admin.service.js';

export class AdminController {
  static async getSettings(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const settings = await AdminService.getInstitutionSettings(institutionId);
      return res.status(200).json(settings);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to fetch settings' });
    }
  }

  static async updateSettings(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const actorUserId = req.user!.userId;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const updated = await AdminService.updateInstitutionSettings(
        institutionId,
        req.body,
        actorUserId,
        ipAddress,
        userAgent
      );

      return res.status(200).json({
        message: 'Institution settings updated successfully',
        settings: updated,
      });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to update settings' });
    }
  }

  static async getAuditLogs(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const { action, resource, userId, startDate, endDate, limit, offset } = req.query;

      const result = await AdminService.getAuditLogs(institutionId, {
        action: action ? String(action) : undefined,
        resource: resource ? String(resource) : undefined,
        userId: userId ? String(userId) : undefined,
        startDate: startDate ? new Date(String(startDate)) : undefined,
        endDate: endDate ? new Date(String(endDate)) : undefined,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to fetch audit logs' });
    }
  }

  static async getUsers(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const { role, search, limit, offset } = req.query;

      const result = await AdminService.getUsers(institutionId, {
        role: role as any,
        search: search ? String(search) : undefined,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to fetch users' });
    }
  }

  static async toggleUserStatus(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const actorUserId = req.user!.userId;
      const { id } = req.params;
      const { isActive } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'isActive boolean flag is required' });
      }

      const updated = await AdminService.toggleUserStatus(
        institutionId,
        id,
        isActive,
        actorUserId,
        ipAddress,
        userAgent
      );

      return res.status(200).json({
        message: `User ${isActive ? 'reactivated' : 'deactivated'} successfully`,
        user: updated,
      });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to toggle user status' });
    }
  }

  static async getGradeRules(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const rules = await AdminService.getGradeRules(institutionId);
      return res.status(200).json(rules);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to fetch grade rules' });
    }
  }

  static async updateGradeRules(req: Request, res: Response) {
    try {
      const institutionId = req.institutionId!;
      const actorUserId = req.user!.userId;
      const { rules } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (!Array.isArray(rules)) {
        return res.status(400).json({ message: 'rules array is required' });
      }

      const updated = await AdminService.updateGradeRules(
        institutionId,
        rules,
        actorUserId,
        ipAddress,
        userAgent
      );

      return res.status(200).json({
        message: 'Grade rules updated successfully',
        rules: updated,
      });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || 'Failed to update grade rules' });
    }
  }
}
