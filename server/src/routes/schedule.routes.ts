import { Router } from 'express';
import { RoleType } from '@prisma/client';
import { ScheduleController } from '../controllers/schedule.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { scopeTenant } from '../middleware/scopeTenant.js';
import { authorize } from '../middleware/authorize.js';
import { validateRequest } from '../middleware/validate.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { uploadSingle } from '../middleware/upload.js';
import { calendarEventBodySchema, calendarEventIdSchema, calendarEventListSchema, overrideBodySchema, overrideRouteSchema, periodBodySchema, periodIdSchema, timetableBodySchema, timetableIdSchema, timetableListSchema } from '../utils/schedule.validators.js';

const router = Router();
router.use(authenticate, scopeTenant);
const admin = authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN);
const anyCalendarUser = authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.HOD, RoleType.CLASS_INCHARGE, RoleType.FACULTY, RoleType.STUDENT);
router.get('/me', anyCalendarUser, validateRequest(calendarEventListSchema), ScheduleController.myCalendar);

router.get('/periods', admin, ScheduleController.listPeriods);
router.post('/periods', admin, validateRequest(periodBodySchema), ScheduleController.createPeriod);
router.put('/periods/:id', admin, validateRequest(periodIdSchema.merge(periodBodySchema)), ScheduleController.updatePeriod);
router.delete('/periods/:id', admin, validateRequest(periodIdSchema), ScheduleController.deletePeriod);

router.get('/timetable', admin, validateRequest(timetableListSchema), ScheduleController.listTimetable);
router.post('/timetable/import', admin, uploadLimiter, uploadSingle('spreadsheets', 10 * 1024 * 1024), ScheduleController.importTimetable);
router.post('/timetable', admin, validateRequest(timetableBodySchema), ScheduleController.createTimetable);
router.put('/timetable/:id', admin, validateRequest(timetableIdSchema.merge(timetableBodySchema)), ScheduleController.updateTimetable);
router.delete('/timetable/:id', admin, validateRequest(timetableIdSchema), ScheduleController.deleteTimetable);

router.get('/events', admin, validateRequest(calendarEventListSchema), ScheduleController.listEvents);
router.post('/events', admin, validateRequest(calendarEventBodySchema), ScheduleController.createEvent);
router.put('/events/:id', admin, validateRequest(calendarEventIdSchema.merge(calendarEventBodySchema)), ScheduleController.updateEvent);
router.delete('/events/:id', admin, validateRequest(calendarEventIdSchema), ScheduleController.deleteEvent);

router.get('/overrides', admin, validateRequest(calendarEventListSchema), ScheduleController.listOverrides);
router.post('/timetable/:id/overrides', admin, validateRequest(overrideRouteSchema.merge(overrideBodySchema)), ScheduleController.createOverride);
router.delete('/overrides/:id', admin, validateRequest(calendarEventIdSchema), ScheduleController.deleteOverride);
export default router;
