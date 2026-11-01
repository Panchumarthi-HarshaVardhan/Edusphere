import { Request, Response, NextFunction } from 'express';
import { PrivacyService } from '../services/privacy.service.js';

export class PrivacyController {
  static async exportOwnData(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await PrivacyService.exportOwnData(req.institutionId!, req.user!.userId);
      res.setHeader('Content-Disposition', `attachment; filename="edusphere-user-data-${req.user!.userId}.json"`);
      return res.status(200).json(data);
    } catch (error) { return next(error); }
  }

  static async anonymizeOwnAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PrivacyService.anonymizeOwnAccount(req.institutionId!, req.user!.userId);
      res.clearCookie('edusphere_refresh_token', {
        httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
      });
      return res.status(200).json(result);
    } catch (error) { return next(error); }
  }

  static async recordGuardianConsent(req: Request, res: Response, next: NextFunction) {
    try {
      const consent = await PrivacyService.recordGuardianConsent(req.institutionId!, req.user!.userId, req.params.id, req.body);
      return res.status(201).json({ consent });
    } catch (error) { return next(error); }
  }

  static async revokeGuardianConsent(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PrivacyService.revokeGuardianConsent(req.institutionId!, req.user!.userId, req.params.id);
      return res.status(200).json(result);
    } catch (error) { return next(error); }
  }

  static async setMinorStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PrivacyService.setMinorStatus(req.institutionId!, req.user!.userId, req.params.id, req.body.isMinor);
      return res.status(200).json({ user: result });
    } catch (error) { return next(error); }
  }

  static async getRetentionSettings(req: Request, res: Response, next: NextFunction) {
    try {
      return res.status(200).json({ settings: await PrivacyService.getRetentionSettings(req.institutionId!) });
    } catch (error) { return next(error); }
  }

  static async updateRetentionSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await PrivacyService.updateRetentionSettings(req.institutionId!, req.user!.userId, req.body);
      return res.status(200).json({ settings });
    } catch (error) { return next(error); }
  }
}
