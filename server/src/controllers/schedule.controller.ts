import { Request, Response } from 'express';
import { ScheduleError, ScheduleService } from '../services/schedule.service.js';

const handle = (action: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response) => {
  try { return res.status(status).json(await action(req)); }
  catch (error: any) {
    const code = error instanceof ScheduleError ? error.status : 500;
    return res.status(code).json({ message: error.message || 'Schedule request failed', ...(error.details ? { details: error.details } : {}) });
  }
};
const tenant = (req: Request) => req.institutionId!;
const actor = (req: Request) => req.user!.userId;
const date = (value: unknown) => value ? new Date(String(value)) : undefined;

export class ScheduleController {
  static importTimetable = handle((req) => {
    if (!req.file) throw new ScheduleError('Choose a CSV or XLSX timetable file.');
    return ScheduleService.importTimetable(tenant(req), actor(req), req.file, req);
  });
  static listPeriods = handle((req) => ScheduleService.listPeriods(tenant(req)));
  static createPeriod = handle((req) => ScheduleService.createPeriod(tenant(req), actor(req), req.body, req), 201);
  static updatePeriod = handle((req) => ScheduleService.updatePeriod(tenant(req), actor(req), req.params.id, req.body, req));
  static deletePeriod = handle((req) => ScheduleService.deletePeriod(tenant(req), actor(req), req.params.id, req));
  static listTimetable = handle((req) => ScheduleService.listTimetable(tenant(req), { sectionId: req.query.sectionId as string, facultyId: req.query.facultyId as string }));
  static createTimetable = handle((req) => ScheduleService.createTimetableSlot(tenant(req), actor(req), req.body, req), 201);
  static updateTimetable = handle((req) => ScheduleService.updateTimetableSlot(tenant(req), actor(req), req.params.id, req.body, req));
  static deleteTimetable = handle((req) => ScheduleService.deleteTimetableSlot(tenant(req), actor(req), req.params.id, req));
  static listEvents = handle((req) => ScheduleService.listCalendarEvents(tenant(req), { startDate: date(req.query.startDate), endDate: date(req.query.endDate) }));
  static createEvent = handle((req) => ScheduleService.createCalendarEvent(tenant(req), actor(req), req.body, req), 201);
  static updateEvent = handle((req) => ScheduleService.updateCalendarEvent(tenant(req), actor(req), req.params.id, req.body, req));
  static deleteEvent = handle((req) => ScheduleService.deleteCalendarEvent(tenant(req), actor(req), req.params.id, req));
  static listOverrides = handle((req) => ScheduleService.listOverrides(tenant(req), date(req.query.startDate), date(req.query.endDate)));
  static createOverride = handle((req) => ScheduleService.createOverride(tenant(req), actor(req), req.params.id, req.body, req), 201);
  static deleteOverride = handle((req) => ScheduleService.deleteOverride(tenant(req), actor(req), req.params.id, req));
  static myCalendar = handle((req) => ScheduleService.getUserCalendar(tenant(req), actor(req), req.user!.role, date(req.query.startDate), date(req.query.endDate)));
}
