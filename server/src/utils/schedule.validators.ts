import { CalendarEventType, TimetableOverrideType } from '@prisma/client';
import { z } from 'zod';

const id = z.string().uuid();
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm format');

const periodBody = z.object({
  number: z.coerce.number().int().positive().max(20),
  name: z.string().trim().min(1).max(80),
  startTime: time,
  endTime: time,
  isActive: z.boolean().optional(),
}).refine((period) => period.startTime < period.endTime, { path: ['endTime'], message: 'End time must be after start time' });
export const periodBodySchema = z.object({ body: periodBody });

export const periodIdSchema = z.object({ params: z.object({ id }) });

export const timetableBodySchema = z.object({ body: z.object({
  sectionId: id,
  subjectId: id,
  facultyId: id,
  periodId: id,
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  roomNumber: z.string().trim().max(80).optional().or(z.literal('')),
}) });

export const timetableListSchema = z.object({
  query: z.object({ sectionId: id.optional(), facultyId: id.optional() }).passthrough(),
});
export const timetableIdSchema = z.object({ params: z.object({ id }) });

const calendarEventBody = z.object({
  type: z.nativeEnum(CalendarEventType),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  sectionId: id.optional().nullable(),
}).refine((event) => event.endDate >= event.startDate, { path: ['endDate'], message: 'End date must not precede start date' });
export const calendarEventBodySchema = z.object({ body: calendarEventBody });
export const calendarEventIdSchema = z.object({ params: z.object({ id }) });
export const calendarEventListSchema = z.object({
  query: z.object({ startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional() }).passthrough(),
});

const overrideBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format'),
  type: z.nativeEnum(TimetableOverrideType),
  substituteFacultyId: id.optional().nullable(),
  substituteRoom: z.string().trim().max(80).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
}).superRefine((value, context) => {
  if (value.type === TimetableOverrideType.SUBSTITUTE && !value.substituteFacultyId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['substituteFacultyId'], message: 'A substitute faculty member is required' });
  }
  if (value.type === TimetableOverrideType.CANCELLED && value.substituteFacultyId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['substituteFacultyId'], message: 'Cancelled classes cannot have a substitute faculty member' });
  }
});
export const overrideBodySchema = z.object({ body: overrideBody });
export const overrideRouteSchema = z.object({ params: z.object({ id }) });
