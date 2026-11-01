import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { scopeTenant } from '../middleware/scopeTenant.js';
import { authorize } from '../middleware/authorize.js';
import { RoleType } from '@prisma/client';

const router = Router();

// Protect all routes with authentication & tenant scoping (Rule 1 & Rule 2)
router.use(authenticate, scopeTenant);

// In-app Bell & Notifications
router.get('/', NotificationController.getNotifications);
router.patch('/mark-all-read', NotificationController.markAllAsRead);
router.patch('/:id/read', NotificationController.markAsRead);

// User Notification Preferences
router.get('/preferences', NotificationController.getPreferences);
router.put('/preferences', NotificationController.updatePreferences);

// Background Email Queue Dispatch Endpoint
router.get('/email-queue/health', authorize(RoleType.ADMIN, RoleType.SUPER_ADMIN), NotificationController.getEmailQueueHealth);
router.post('/process-email-queue', authorize(RoleType.ADMIN, RoleType.SUPER_ADMIN), NotificationController.triggerEmailQueueWorker);

export default router;
