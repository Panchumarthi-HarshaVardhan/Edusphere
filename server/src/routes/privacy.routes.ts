import { Router } from 'express';
import { PrivacyController } from '../controllers/privacy.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { scopeTenant } from '../middleware/scopeTenant.js';

const router = Router();
router.use(authenticate, scopeTenant);
router.get('/me/export', PrivacyController.exportOwnData);
router.delete('/me', PrivacyController.anonymizeOwnAccount);

export default router;
