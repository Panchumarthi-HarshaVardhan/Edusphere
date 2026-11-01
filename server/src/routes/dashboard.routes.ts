import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { scopeTenant } from '../middleware/scopeTenant.js';
import { authorize } from '../middleware/authorize.js';
import { RoleType } from '@prisma/client';
import { requireCommunityConsent } from '../middleware/communityConsent.js';

const router = Router();

// Protect all routes with authentication & tenant scoping (Rule 1 & Rule 2)
router.use(authenticate, scopeTenant);

// Student Dashboard Aggregate
router.get(
  '/student',
  authorize(RoleType.STUDENT, RoleType.ADMIN, RoleType.SUPER_ADMIN),
  DashboardController.getStudentDashboard
);

// Faculty Dashboard Aggregate
router.get(
  '/faculty',
  authorize(RoleType.FACULTY, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.ADMIN, RoleType.SUPER_ADMIN),
  DashboardController.getFacultyDashboard
);

// Doubts (Student asks, Faculty answers)
router.post(
  '/doubts',
  requireCommunityConsent,
  authorize(RoleType.STUDENT),
  DashboardController.askDoubt
);
router.post(
  '/doubts/:id/reply',
  requireCommunityConsent,
  authorize(RoleType.FACULTY, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.ADMIN),
  DashboardController.answerDoubt
);

// Announcements (Faculty / Admin post)
router.post(
  '/announcements',
  requireCommunityConsent,
  authorize(RoleType.FACULTY, RoleType.ADMIN, RoleType.SUPER_ADMIN),
  DashboardController.postAnnouncement
);

export default router;
