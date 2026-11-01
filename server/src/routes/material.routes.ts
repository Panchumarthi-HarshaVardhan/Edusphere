import { Router } from 'express';
import { MaterialController } from '../controllers/material.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { scopeTenant } from '../middleware/scopeTenant.js';
import { authorize } from '../middleware/authorize.js';
import { requireFacultySubjectAssignment } from '../middleware/facultyGuard.js';
import { RoleType } from '@prisma/client';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { uploadSingle } from '../middleware/upload.js';

const router = Router();

// All other material endpoints require Authentication and Tenant Scoping
router.use(authenticate, scopeTenant);

// Local storage fallback still requires the same tenant and audience checks as signed files.
router.get('/stream/:s3Key', MaterialController.streamFile);

// --- Browse & Search (Student, Faculty, Admin) ---
router.get('/subjects', MaterialController.listSubjects);
router.get('/', MaterialController.list);
router.get('/:materialId', MaterialController.getById);
router.get('/:materialId/view-url', MaterialController.getViewUrl);
router.get('/:materialId/download-url', MaterialController.getDownloadUrl);
router.post('/:materialId/bookmark', MaterialController.toggleBookmark);

// Units catalog for a subject
router.get('/subjects/:subjectId/units', MaterialController.listUnits);

// --- Faculty & Admin Restricted Actions ---
router.post(
  '/',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  uploadLimiter,
  uploadSingle('materials', 50 * 1024 * 1024),
  requireFacultySubjectAssignment,
  MaterialController.upload
);

router.post(
  '/:materialId/replace',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireFacultySubjectAssignment,
  uploadLimiter,
  uploadSingle('materials', 50 * 1024 * 1024),
  MaterialController.replaceVersion
);

router.post(
  '/subjects/:subjectId/units',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireFacultySubjectAssignment,
  MaterialController.createUnit
);

export default router;
