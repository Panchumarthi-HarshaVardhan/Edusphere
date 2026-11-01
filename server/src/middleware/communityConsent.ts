import { Request, Response, NextFunction } from 'express';
import { PrivacyService } from '../services/privacy.service.js';

export const requireCommunityConsent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allowed = await PrivacyService.canUseCommunity(req.institutionId!, req.user!.userId);
    if (allowed == null) return res.status(401).json({ message: 'Account is unavailable.' });
    if (!allowed) return res.status(403).json({
      code: 'GUARDIAN_CONSENT_REQUIRED',
      message: 'Guardian consent is required before community features can be used.',
    });
    return next();
  } catch (error) { return next(error); }
};
