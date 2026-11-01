import { Request, Response, NextFunction } from 'express';

export const scopeTenant = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !req.user.institutionId) {
    res.status(403).json({ message: 'Tenant isolation error: Missing institution context.' });
    return;
  }
  
  // Guarantee institutionId is bound to the request
  req.institutionId = req.user.institutionId;

  // Prevent client from overriding or tampering with institutionId in route params or body
  if (req.params?.institutionId && req.params.institutionId !== req.user.institutionId) {
    res.status(403).json({ message: 'Access denied: Cannot access resources across institutions.' });
    return;
  }

  if (req.body && req.body.institutionId && req.body.institutionId !== req.user.institutionId) {
    res.status(403).json({ message: 'Access denied: Institution ID tampering detected.' });
    return;
  }

  next();
};
