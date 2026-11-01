import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { scopeTenant } from '../middleware/scopeTenant.js';
import { authorize } from '../middleware/authorize.js';
import { RoleType } from '@prisma/client';
import { z } from 'zod';
import { AdminSetupController } from '../controllers/admin-setup.controller.js';
import { AdminAnalyticsController } from '../controllers/admin-analytics.controller.js';
import { validateRequest } from '../middleware/validate.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { uploadSingle } from '../middleware/upload.js';
import { PrivacyController } from '../controllers/privacy.controller.js';
import {
  assignmentSchema, createUserSchema, entityBodySchemas, entityPathSchema, entityIdSchema,
  enrollmentSchema, importSchema, institutionSetupSchema, listEntitiesWithPathSchema,
  listUserSetupSchema, promotionSchema, toggleStatusSchema, userIdSchema, minorStatusSchema, guardianConsentSchema, retentionSettingsSchema,
  analyticsQuerySchema, auditLogQuerySchema,
} from '../utils/admin-setup.validators.js';

const router = Router();

// Protect all admin routes: Authentication + Tenant Scoping + Admin Role Guard
router.use(authenticate, scopeTenant, authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN));

// Institution provisioning is restricted to a platform super administrator.
router.post('/institutions', authorize(RoleType.SUPER_ADMIN), validateRequest(institutionSetupSchema), AdminSetupController.createInstitution);

const setupEntities = ['departments', 'programs', 'academic-years', 'semesters', 'sections', 'subjects'] as const;
const entityBody = (req: any, res: any, next: any) => {
  const schema = entityBodySchemas[req.params.entity as keyof typeof entityBodySchemas];
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.errors.map((error) => ({ field: error.path.join('.'), message: error.message })) });
  req.body = parsed.data;
  return next();
};

router.get('/setup/:entity', validateRequest(listEntitiesWithPathSchema), AdminSetupController.listEntity);
const entityIdWithPathSchema = z.object({ params: entityIdSchema.shape.params.extend({ entity: entityPathSchema.shape.params.shape.entity }) });
router.post('/setup/:entity', validateRequest(entityPathSchema), entityBody, AdminSetupController.createEntity);
router.put('/setup/:entity/:id', validateRequest(entityIdWithPathSchema), entityBody, AdminSetupController.updateEntity);
router.delete('/setup/:entity/:id', validateRequest(entityIdWithPathSchema), AdminSetupController.deleteEntity);

router.post('/users', validateRequest(createUserSchema), AdminSetupController.createUser);
router.post('/users/:id/reset-password', validateRequest(userIdSchema), AdminSetupController.resetUserPassword);
router.patch('/users/:id/status', validateRequest(toggleStatusSchema), AdminSetupController.setUserStatus);
router.patch('/users/:id/minor-status', validateRequest(minorStatusSchema), PrivacyController.setMinorStatus);
router.post('/users/:id/guardian-consent', validateRequest(guardianConsentSchema), PrivacyController.recordGuardianConsent);
router.delete('/users/:id/guardian-consent', validateRequest(userIdSchema), PrivacyController.revokeGuardianConsent);
router.get('/data-retention', PrivacyController.getRetentionSettings);
router.put('/data-retention', validateRequest(retentionSettingsSchema), PrivacyController.updateRetentionSettings);
router.get('/faculty-assignments', AdminSetupController.listAssignments);
router.post('/faculty-assignments', validateRequest(assignmentSchema), AdminSetupController.assignFaculty);
router.post('/student-enrollments', validateRequest(enrollmentSchema), AdminSetupController.enrollStudent);
router.post('/sections/:sectionId/promote', validateRequest(promotionSchema), AdminSetupController.promoteSection);
router.get('/users/import/:role/template', AdminSetupController.downloadTemplate);
router.post('/users/import/:role', validateRequest(importSchema), uploadLimiter, uploadSingle('spreadsheets', 10 * 1024 * 1024), AdminSetupController.importUsers);

// Institution Settings & Attendance Threshold
router.get('/settings', AdminController.getSettings);
router.patch('/settings', AdminController.updateSettings);

// Tenant-Scoped Audit Logs (Rule 1 & Rule 4)
router.get('/audit-logs', validateRequest(auditLogQuerySchema), AdminController.getAuditLogs);
router.get('/analytics/dashboard', validateRequest(analyticsQuerySchema), AdminAnalyticsController.dashboard);
router.get('/analytics/attendance-shortages/export', validateRequest(analyticsQuerySchema), AdminAnalyticsController.exportAttendanceShortages);

// User Directory & Status (Soft Delete)
router.get('/users', validateRequest(listUserSetupSchema), AdminController.getUsers);

// Grade Rules Configuration
router.get('/grade-rules', AdminController.getGradeRules);
router.put('/grade-rules', AdminController.updateGradeRules);

export default router;
