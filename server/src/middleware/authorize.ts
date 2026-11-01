import { Request, Response, NextFunction } from 'express';
import { RoleType } from '@prisma/client';

export const authorize = (...allowedRoles: RoleType[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource.`,
      });
      return;
    }

    next();
  };
};
