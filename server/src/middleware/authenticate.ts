import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../utils/prisma.js';

const createAuthenticate = (allowPasswordResetOnly: boolean) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (typeof req.query.token === 'string' && req.query.token.trim()) {
    token = req.query.token.trim();
  }

  if (!token) {
    res.status(401).json({ message: 'Authentication required. No token provided.' });
    return;
  }
  let decoded: ReturnType<typeof verifyAccessToken>;
  try { decoded = verifyAccessToken(token); }
  catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ message: 'Token has expired. Please refresh your token.', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ message: 'Invalid authentication token.' });
    return;
  }
  try {
    const activeUser = await prisma.user.findFirst({
      where: { id: decoded.userId, institutionId: decoded.institutionId, isActive: true },
      select: { id: true },
    });
    if (!activeUser) {
      res.status(401).json({ message: 'Account is unavailable.' });
      return;
    }
    if (decoded.mustResetPassword && !allowPasswordResetOnly) {
      res.status(403).json({ message: 'Reset your password before using this endpoint.', code: 'PASSWORD_RESET_REQUIRED' });
      return;
    }
    req.user = decoded;
    req.institutionId = decoded.institutionId;
    next();
  } catch (error) { next(error); }
};

export const authenticate = createAuthenticate(false);
export const authenticateForPasswordReset = createAuthenticate(true);
