import { Router } from 'express';
import { PublicController } from '../controllers/public.controller.js';
import { validateRequest } from '../middleware/validate.js';
import { demoRequestLimiter } from '../middleware/rateLimit.js';
import { demoRequestSchema } from '../utils/demo-request.validator.js';

const router = Router();
router.post('/demo-requests', demoRequestLimiter, validateRequest(demoRequestSchema), PublicController.createDemoRequest);

export default router;
