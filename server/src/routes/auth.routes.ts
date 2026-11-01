import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate, authenticateForPasswordReset } from '../middleware/authenticate.js';
import { scopeTenant } from '../middleware/scopeTenant.js';
import { validateRequest } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  resetFirstPasswordSchema,
  updateProfileSchema,
} from '../utils/validators.js';

const router = Router();

// Public auth routes (rate limited)
router.post('/login', authLimiter, validateRequest(loginSchema), AuthController.login);
router.post('/refresh', authLimiter, validateRequest(refreshTokenSchema), AuthController.refreshToken);
router.post('/logout', authLimiter, AuthController.logout);

// Protected routes (Tenant-scoped)
router.get('/profile', authenticate, scopeTenant, AuthController.getProfile);
router.patch('/profile', authenticate, scopeTenant, validateRequest(updateProfileSchema), AuthController.updateProfile);
router.post(
  '/change-password',
  authenticate,
  scopeTenant,
  validateRequest(changePasswordSchema),
  AuthController.changePassword
);
router.post(
  '/reset-first-password',
  authenticateForPasswordReset,
  scopeTenant,
  validateRequest(resetFirstPasswordSchema),
  AuthController.resetFirstPassword
);

export default router;
