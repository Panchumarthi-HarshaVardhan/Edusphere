import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';

const REFRESH_COOKIE_NAME = 'edusphere_refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { institutionCode, email, password } = req.body;
      const result = await AuthService.login(institutionCode, email, password, req);

      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        message: 'Login successful',
        accessToken: result.accessToken,
        refreshToken: result.refreshToken, // Also return in body for mobile/flexible clients
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies[REFRESH_COOKIE_NAME] || req.body.refreshToken;
      const result = await AuthService.refreshTokens(token, req);

      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies[REFRESH_COOKIE_NAME] || req.body.refreshToken;
      await AuthService.logout(token, req.user?.userId, req);

      res.clearCookie(REFRESH_COOKIE_NAME, COOKIE_OPTIONS);
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        user: req.user,
        institutionId: req.institutionId,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await AuthService.updateProfile(
        req.user!.userId,
        req.institutionId!,
        req.body,
        req
      );
      res.status(200).json({ message: 'Profile updated', user });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.userId;
      const institutionId = req.institutionId!;

      const result = await AuthService.changePassword(
        userId,
        institutionId,
        currentPassword,
        newPassword,
        req
      );

      res.clearCookie(REFRESH_COOKIE_NAME, COOKIE_OPTIONS);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async resetFirstPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { newPassword } = req.body;
      const userId = req.user!.userId;
      const institutionId = req.institutionId!;

      const result = await AuthService.resetFirstPassword(
        userId,
        institutionId,
        newPassword,
        req
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
