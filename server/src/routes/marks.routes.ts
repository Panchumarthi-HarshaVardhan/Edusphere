import { Router } from 'express';
import { MarksController } from '../controllers/marks.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { scopeTenant } from '../middleware/scopeTenant.js';
import { authorize } from '../middleware/authorize.js';
import { requireResourceAssignment } from '../middleware/resourceAssignment.js';
import { RoleType } from '@prisma/client';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { uploadSingle } from '../middleware/upload.js';

const router = Router();

// Protect all marks routes with Auth and Tenant Scoping
router.use(authenticate, scopeTenant);

// --- Student Endpoints (Rule 5: Only published marks) ---
router.get('/student-report', authorize(RoleType.STUDENT, RoleType.ADMIN, RoleType.SUPER_ADMIN), MarksController.getStudentMarks);
router.post('/corrections', authorize(RoleType.STUDENT), MarksController.requestCorrection);

// --- Faculty & Admin Assessment Configuration & Grading ---
router.get(
  '/assessments',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  MarksController.listAssessments
);

router.post(
  '/assessments',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('subject-section'),
  MarksController.createAssessment
);

router.get(
  '/assessments/:assessmentId',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('assessment'),
  MarksController.getAssessmentDetails
);

router.put(
  '/assessments/:assessmentId/marks',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('assessment'),
  MarksController.saveMarks
);

router.patch(
  '/assessments/:assessmentId/publish',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('assessment'),
  MarksController.updatePublication
);

router.get(
  '/assessments/:assessmentId/stats',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('assessment'),
  MarksController.getClassStats
);

router.post(
  '/assessments/:assessmentId/bulk-upload',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('assessment'),
  uploadLimiter,
  uploadSingle('spreadsheets', 10 * 1024 * 1024),
  MarksController.uploadExcel
);

export default router;
