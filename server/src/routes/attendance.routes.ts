import { Router } from 'express';
import { AttendanceController } from '../controllers/attendance.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { scopeTenant } from '../middleware/scopeTenant.js';
import { authorize } from '../middleware/authorize.js';
import { requireResourceAssignment } from '../middleware/resourceAssignment.js';
import { RoleType } from '@prisma/client';

const router = Router();

// Protect all attendance routes with Auth and Tenant Scoping
router.use(authenticate, scopeTenant);

// --- Student Endpoints ---
router.get('/student-aggregate', authorize(RoleType.STUDENT, RoleType.ADMIN, RoleType.SUPER_ADMIN), AttendanceController.getStudentAggregate);
router.post('/corrections', authorize(RoleType.STUDENT), AttendanceController.requestCorrection);

// --- Faculty & Admin Endpoints ---
router.get(
  '/pending-sessions',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  AttendanceController.getPendingSessions
);

router.post(
  '/sessions',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('subject-section'),
  AttendanceController.createOrGetSession
);

router.put(
  '/sessions/:sessionId',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('attendance-session'),
  AttendanceController.submitAttendance
);

router.post(
  '/corrections/:requestId/review',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('attendance-correction'),
  AttendanceController.reviewCorrection
);

router.get(
  '/reports/monthly',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('subject-section'),
  AttendanceController.getMonthlyReport
);

router.get(
  '/reports/monthly/excel',
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY),
  requireResourceAssignment('subject-section'),
  AttendanceController.exportMonthlyExcel
);

export default router;
