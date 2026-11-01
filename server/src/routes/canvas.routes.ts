import { Router } from 'express';
import { CanvasController } from '../controllers/canvas.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { scopeTenant } from '../middleware/scopeTenant.js';
import { authorize } from '../middleware/authorize.js';
import { requireResourceAssignment } from '../middleware/resourceAssignment.js';
import { RoleType } from '@prisma/client';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { uploadSingle } from '../middleware/upload.js';

const router = Router();

// Protect all canvas routes with Auth and Tenant Scoping
router.use(authenticate, scopeTenant);

// --- Student, Faculty & Admin Browsing ---
router.get('/sessions', CanvasController.listSessions);
router.get('/sessions/:sessionId', requireResourceAssignment('classroom-session'), CanvasController.getSessionById);
router.get('/assets/:assetId', requireResourceAssignment('canvas-asset'), CanvasController.streamAsset);

// --- Faculty & Admin Interactive Workspace Actions ---
router.post(
  '/sessions',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('subject-section'),
  CanvasController.createSession
);

router.post(
  '/sessions/:sessionId/complete',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('classroom-session'),
  CanvasController.completeSession
);

router.put(
  '/sessions/:sessionId/pages/:pageNumber',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('classroom-session'),
  CanvasController.savePage
);

router.post(
  '/sessions/:sessionId/pages',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('classroom-session'),
  CanvasController.addPage
);

router.delete(
  '/sessions/:sessionId/pages/:pageNumber',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('classroom-session'),
  CanvasController.deletePage
);

router.post(
  '/sessions/:sessionId/import-slides',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('classroom-session'),
  uploadLimiter,
  uploadSingle('slides', 50 * 1024 * 1024),
  CanvasController.importSlides
);

router.post(
  '/sessions/:sessionId/assets/upload',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('classroom-session'),
  uploadLimiter,
  uploadSingle('images', 10 * 1024 * 1024),
  CanvasController.uploadAsset
);

export default router;
