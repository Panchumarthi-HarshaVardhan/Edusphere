import { CalendarEventType, NotificationCategory, RoleType, TimetableOverrideType } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { createAuditLog } from './audit.service.js';
import { NotificationService } from './notification.service.js';
import { findScheduleClashes, type ScheduleSlotForClash } from './schedule-clashes.js';
import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { z } from 'zod';

export class ScheduleError extends Error {
  constructor(message: string, public status = 400, public details?: unknown) { super(message); }
}

export class ScheduleService {
  static async importTimetable(institutionId: string, actorId: string, file: Express.Multer.File, req?: any) {
    const workbook = new ExcelJS.Workbook();
    try {
      if (/\.csv$/i.test(file.originalname)) {
        await workbook.csv.read(Readable.from([file.buffer]));
      } else {
        await workbook.xlsx.load(file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
      }
    } catch {
      throw new ScheduleError('Could not read timetable file. Upload a valid CSV or XLSX file.');
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) throw new ScheduleError('The timetable file must include a header and at least one class row.');
    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => headers.set(String(cell.value || '').trim().toLowerCase(), column));
    const required = ['sectionname', 'subjectcode', 'facultyemail', 'periodnumber', 'dayofweek'];
    const missing = required.filter((header) => !headers.has(header));
    if (missing.length) throw new ScheduleError(`Missing required columns: ${missing.join(', ')}`);

    const errors: Array<{ row: number; message: string }> = [];
    let importedCount = 0;
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const hasValues = Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text.trim()).some(Boolean);
      if (!hasValues) continue;
      const value = (header: string) => String(row.getCell(headers.get(header)!).text || row.getCell(headers.get(header)!).value || '').trim();
      const parsed = timetableImportRow.safeParse({
        sectionName: value('sectionname'), subjectCode: value('subjectcode'), facultyEmail: value('facultyemail'),
        periodNumber: value('periodnumber'), dayOfWeek: value('dayofweek'), roomNumber: headers.has('roomnumber') ? value('roomnumber') : '',
      });
      if (!parsed.success) {
        errors.push({ row: rowNumber, message: parsed.error.issues.map((issue) => issue.message).join('; ') });
        continue;
      }
      try {
        const item = parsed.data;
        const [sections, subjects, faculty, period] = await Promise.all([
          prisma.section.findMany({ where: { institutionId, name: { equals: item.sectionName, mode: 'insensitive' } }, select: { id: true } }),
          prisma.subject.findMany({ where: { institutionId, code: { equals: item.subjectCode, mode: 'insensitive' } }, select: { id: true } }),
          prisma.user.findMany({ where: { institutionId, email: { equals: item.facultyEmail, mode: 'insensitive' }, role: { in: [RoleType.FACULTY, RoleType.HOD, RoleType.CLASS_INCHARGE] }, isActive: true }, select: { id: true } }),
          prisma.period.findFirst({ where: { institutionId, number: item.periodNumber, isActive: true }, select: { id: true } }),
        ]);
        if (sections.length !== 1) throw new ScheduleError(sections.length ? 'Section name is ambiguous' : 'Section not found in this institution', 400);
        if (subjects.length !== 1) throw new ScheduleError(subjects.length ? 'Subject code is ambiguous' : 'Subject not found in this institution', 400);
        if (faculty.length !== 1) throw new ScheduleError(faculty.length ? 'Faculty email is ambiguous' : 'Faculty not found in this institution', 400);
        if (!period) throw new ScheduleError('Period number not found in this institution', 400);
        await this.createTimetableSlot(institutionId, actorId, {
          sectionId: sections[0].id, subjectId: subjects[0].id, facultyId: faculty[0].id,
          periodId: period.id, dayOfWeek: item.dayOfWeek, roomNumber: item.roomNumber,
        }, req);
        importedCount += 1;
      } catch (error) {
        errors.push({ row: rowNumber, message: error instanceof Error ? error.message : 'Could not import this row' });
      }
    }
    await audit(institutionId, actorId, 'IMPORT_TIMETABLE', 'timetable', null, { importedCount, errorCount: errors.length, errors }, req);
    return { importedCount, errorCount: errors.length, errors };
  }

  static listPeriods(institutionId: string) {
    return prisma.period.findMany({ where: { institutionId }, orderBy: { number: 'asc' } });
  }

  static async createPeriod(institutionId: string, actorId: string, input: any, req?: any) {
    try {
      const period = await prisma.period.create({ data: { institutionId, ...input } });
      await audit(institutionId, actorId, 'CREATE_PERIOD', 'period', period.id, input, req);
      return period;
    } catch (error: any) { if (error?.code === 'P2002') throw new ScheduleError('A period with this number already exists', 409); throw error; }
  }

  static async updatePeriod(institutionId: string, actorId: string, id: string, input: any, req?: any) {
    const current = await prisma.period.findFirst({ where: { id, institutionId } });
    if (!current) throw new ScheduleError('Period not found', 404);
    const affectedSlots = await prisma.timetableSlot.findMany({ where: { institutionId, periodId: id }, select: { id: true, sectionId: true, facultyId: true, dayOfWeek: true, roomNumber: true } });
    for (const slot of affectedSlots) {
      await assertAvailable(institutionId, { ...slot, startTime: input.startTime, endTime: input.endTime });
    }
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const period = await tx.period.update({ where: { id, institutionId }, data: input });
        await tx.timetableSlot.updateMany({ where: { institutionId, periodId: id }, data: { startTime: period.startTime, endTime: period.endTime, periodNumber: period.number } });
        return period;
      });
      await audit(institutionId, actorId, 'UPDATE_PERIOD', 'period', id, { before: current, after: updated }, req);
      return updated;
    } catch (error: any) { if (error?.code === 'P2002') throw new ScheduleError('Changing this period would create duplicate section periods', 409); throw error; }
  }

  static async deletePeriod(institutionId: string, actorId: string, id: string, req?: any) {
    const period = await prisma.period.findFirst({ where: { id, institutionId } });
    if (!period) throw new ScheduleError('Period not found', 404);
    if (await prisma.timetableSlot.count({ where: { institutionId, periodId: id } })) throw new ScheduleError('Remove timetable entries using this period first', 409);
    await prisma.period.delete({ where: { id, institutionId } });
    await audit(institutionId, actorId, 'DELETE_PERIOD', 'period', id, period, req);
    return { id };
  }

  static async listTimetable(institutionId: string, filters: { sectionId?: string; facultyId?: string } = {}) {
    return prisma.timetableSlot.findMany({
      where: { institutionId, ...(filters.sectionId ? { sectionId: filters.sectionId } : {}), ...(filters.facultyId ? { facultyId: filters.facultyId } : {}) },
      include: timetableInclude,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }, { section: { name: 'asc' } }],
    });
  }

  static async createTimetableSlot(institutionId: string, actorId: string, input: any, req?: any) {
    const valid = await validateTimetableInput(institutionId, input);
    const candidate: ScheduleSlotForClash = {
      ...input, startTime: valid.period.startTime, endTime: valid.period.endTime,
      roomNumber: input.roomNumber || null,
    };
    await assertAvailable(institutionId, candidate);
    try {
      const slot = await prisma.timetableSlot.create({ data: {
        institutionId, sectionId: input.sectionId, subjectId: input.subjectId,
        facultyId: input.facultyId, periodId: input.periodId,
        dayOfWeek: input.dayOfWeek, periodNumber: valid.period.number,
        startTime: valid.period.startTime, endTime: valid.period.endTime,
        roomNumber: input.roomNumber || null,
      }, include: timetableInclude });
      await audit(institutionId, actorId, 'CREATE_TIMETABLE_SLOT', 'timetable_slot', slot.id, input, req);
      return slot;
    } catch (error: any) { if (error?.code === 'P2002') throw new ScheduleError('Section already has an entry in this period', 409); throw error; }
  }

  static async updateTimetableSlot(institutionId: string, actorId: string, id: string, input: any, req?: any) {
    const current = await prisma.timetableSlot.findFirst({ where: { id, institutionId } });
    if (!current) throw new ScheduleError('Timetable entry not found', 404);
    const valid = await validateTimetableInput(institutionId, input);
    const candidate: ScheduleSlotForClash = {
      id, ...input, startTime: valid.period.startTime, endTime: valid.period.endTime,
      roomNumber: input.roomNumber || null,
    };
    await assertAvailable(institutionId, candidate);
    try {
      const slot = await prisma.timetableSlot.update({ where: { id, institutionId }, data: {
        sectionId: input.sectionId, subjectId: input.subjectId, facultyId: input.facultyId,
        periodId: input.periodId, dayOfWeek: input.dayOfWeek, periodNumber: valid.period.number,
        startTime: valid.period.startTime, endTime: valid.period.endTime, roomNumber: input.roomNumber || null,
      }, include: timetableInclude });
      await audit(institutionId, actorId, 'UPDATE_TIMETABLE_SLOT', 'timetable_slot', id, { before: current, after: slot }, req);
      return slot;
    } catch (error: any) { if (error?.code === 'P2002') throw new ScheduleError('Section already has an entry in this period', 409); throw error; }
  }

  static async deleteTimetableSlot(institutionId: string, actorId: string, id: string, req?: any) {
    const slot = await prisma.timetableSlot.findFirst({ where: { id, institutionId } });
    if (!slot) throw new ScheduleError('Timetable entry not found', 404);
    await prisma.timetableSlot.delete({ where: { id, institutionId } });
    await audit(institutionId, actorId, 'DELETE_TIMETABLE_SLOT', 'timetable_slot', id, slot, req);
    return { id };
  }

  static listCalendarEvents(institutionId: string, filters: { startDate?: Date; endDate?: Date } = {}) {
    return prisma.academicCalendarEvent.findMany({
      where: {
        institutionId,
        ...(filters.startDate || filters.endDate ? { startDate: { ...(filters.endDate ? { lte: filters.endDate } : {}) }, endDate: { ...(filters.startDate ? { gte: filters.startDate } : {}) } } : {}),
      },
      include: { section: { select: { id: true, name: true } } },
      orderBy: [{ startDate: 'asc' }, { title: 'asc' }],
    });
  }

  static async createCalendarEvent(institutionId: string, actorId: string, input: any, req?: any) {
    if (input.sectionId) await requireInTenant('section', input.sectionId, institutionId, 'Section');
    const event = await prisma.academicCalendarEvent.create({ data: { institutionId, createdById: actorId, ...input }, include: { section: true } });
    await audit(institutionId, actorId, 'CREATE_CALENDAR_EVENT', 'calendar_event', event.id, input, req);
    return event;
  }

  static async updateCalendarEvent(institutionId: string, actorId: string, id: string, input: any, req?: any) {
    const current = await prisma.academicCalendarEvent.findFirst({ where: { id, institutionId } });
    if (!current) throw new ScheduleError('Calendar event not found', 404);
    if (input.sectionId) await requireInTenant('section', input.sectionId, institutionId, 'Section');
    const event = await prisma.academicCalendarEvent.update({ where: { id, institutionId }, data: input, include: { section: true } });
    await audit(institutionId, actorId, 'UPDATE_CALENDAR_EVENT', 'calendar_event', id, { before: current, after: event }, req);
    return event;
  }

  static async deleteCalendarEvent(institutionId: string, actorId: string, id: string, req?: any) {
    const event = await prisma.academicCalendarEvent.findFirst({ where: { id, institutionId } });
    if (!event) throw new ScheduleError('Calendar event not found', 404);
    await prisma.academicCalendarEvent.delete({ where: { id, institutionId } });
    await audit(institutionId, actorId, 'DELETE_CALENDAR_EVENT', 'calendar_event', id, event, req);
    return { id };
  }

  static async createOverride(institutionId: string, actorId: string, slotId: string, input: any, req?: any) {
    const slot = await prisma.timetableSlot.findFirst({ where: { id: slotId, institutionId }, include: { section: true, subject: true, faculty: true } });
    if (!slot) throw new ScheduleError('Timetable entry not found', 404);
    const date = new Date(`${input.date}T00:00:00.000Z`);
    if (input.substituteFacultyId) {
      const substitute = await prisma.user.findFirst({ where: { id: input.substituteFacultyId, institutionId, role: { in: [RoleType.FACULTY, RoleType.HOD, RoleType.CLASS_INCHARGE] }, isActive: true } });
      if (!substitute) throw new ScheduleError('Substitute faculty not found in this institution', 404);
    }
    const override = await prisma.timetableOverride.upsert({
      where: { institutionId_timetableSlotId_date: { institutionId, timetableSlotId: slotId, date } },
      create: { institutionId, timetableSlotId: slotId, date, type: input.type, substituteFacultyId: input.substituteFacultyId || null, substituteRoom: input.substituteRoom || null, note: input.note || null, createdById: actorId },
      update: { type: input.type, substituteFacultyId: input.substituteFacultyId || null, substituteRoom: input.substituteRoom || null, note: input.note || null, createdById: actorId },
      include: { substituteFaculty: { select: { id: true, firstName: true, lastName: true } } },
    });
    await audit(institutionId, actorId, input.type === TimetableOverrideType.CANCELLED ? 'CANCEL_CLASS' : 'SUBSTITUTE_CLASS', 'timetable_override', override.id, { slotId, date: input.date, ...input }, req);

    const enrollments = await prisma.studentEnrollment.findMany({ where: { institutionId, sectionId: slot.sectionId, status: 'ACTIVE' }, select: { studentId: true } });
    const recipientIds = [...new Set([slot.facultyId, input.substituteFacultyId, ...enrollments.map((row) => row.studentId)].filter(Boolean) as string[])];
    const actionText = input.type === TimetableOverrideType.CANCELLED ? 'cancelled' : 'changed';
    const body = input.type === TimetableOverrideType.CANCELLED
      ? `${slot.subject.code} ${slot.subject.name} for ${slot.section.name} on ${input.date} has been cancelled.${input.note ? ` ${input.note}` : ''}`
      : `${slot.subject.code} ${slot.subject.name} for ${slot.section.name} on ${input.date} has a substitute faculty member${override.substituteFaculty ? `: ${override.substituteFaculty.firstName} ${override.substituteFaculty.lastName}` : ''}.${input.note ? ` ${input.note}` : ''}`;
    await NotificationService.createNotification(institutionId, recipientIds, NotificationCategory.ACADEMIC, `Class ${actionText}`, body, '/calendar');
    return override;
  }

  static listOverrides(institutionId: string, startDate?: Date, endDate?: Date) {
    return prisma.timetableOverride.findMany({
      where: { institutionId, ...(startDate || endDate ? { date: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } } : {}) },
      include: { timetableSlot: { include: timetableInclude }, substituteFaculty: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: 'asc' },
    });
  }

  static async deleteOverride(institutionId: string, actorId: string, id: string, req?: any) {
    const override = await prisma.timetableOverride.findFirst({ where: { id, institutionId } });
    if (!override) throw new ScheduleError('Timetable override not found', 404);
    await prisma.timetableOverride.delete({ where: { id, institutionId } });
    await audit(institutionId, actorId, 'DELETE_TIMETABLE_OVERRIDE', 'timetable_override', id, override, req);
    return { id };
  }

  static async getUserCalendar(institutionId: string, userId: string, role: RoleType, startDate?: Date, endDate?: Date) {
    const start = atMidnight(startDate || new Date());
    const end = atMidnight(endDate || addDays(start, 6));
    if (end < start) throw new ScheduleError('endDate must be on or after startDate');
    const sectionIds = await visibleSectionIds(institutionId, userId, role, start, end);
    const globalOnly = Array.isArray(sectionIds) && sectionIds.length === 0;
    const eventWhere: any = { institutionId, startDate: { lte: endOfDay(end) }, endDate: { gte: start } };
    if (Array.isArray(sectionIds)) eventWhere.OR = [
      { sectionId: null },
      { sectionId: { isSet: false } },
      ...(sectionIds.length ? [{ sectionId: { in: sectionIds } }] : []),
    ];
    const slotWhere: any = { institutionId, dayOfWeek: { in: daysInRange(start, end) } };
    if (role === RoleType.STUDENT) slotWhere.sectionId = { in: sectionIds as string[] };
    else if (role === RoleType.FACULTY || role === RoleType.HOD || role === RoleType.CLASS_INCHARGE) {
      slotWhere.OR = [
        { facultyId: userId },
        { overrides: { some: { institutionId, substituteFacultyId: userId, date: { gte: start, lte: end } } } },
      ];
    }
    if (globalOnly && role === RoleType.STUDENT) slotWhere.sectionId = { in: [] };
    const [slots, overrides, events] = await Promise.all([
      prisma.timetableSlot.findMany({ where: slotWhere, include: { ...timetableInclude, overrides: { where: { institutionId, date: { gte: start, lte: end } }, include: { substituteFaculty: { select: { id: true, firstName: true, lastName: true } } } } }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] }),
      prisma.timetableOverride.findMany({ where: { institutionId, date: { gte: start, lte: end }, ...(role === RoleType.FACULTY || role === RoleType.HOD || role === RoleType.CLASS_INCHARGE ? { substituteFacultyId: userId } : {}) }, select: { timetableSlotId: true, date: true } }),
      prisma.academicCalendarEvent.findMany({ where: eventWhere, include: { section: { select: { id: true, name: true } } }, orderBy: { startDate: 'asc' } }),
    ]);
    const slotIds = [...new Set(overrides.map((override) => override.timetableSlotId))];
    const substituteSlots = slotIds.length ? await prisma.timetableSlot.findMany({
      where: { institutionId, id: { in: slotIds }, ...(role === RoleType.FACULTY || role === RoleType.HOD || role === RoleType.CLASS_INCHARGE ? { sectionId: { in: sectionIds as string[] } } : {}) },
      include: { ...timetableInclude, overrides: { where: { institutionId, date: { gte: start, lte: end } }, include: { substituteFaculty: { select: { id: true, firstName: true, lastName: true } } } } },
    }) : [];
    const slotMap = new Map([...slots, ...substituteSlots].map((slot) => [slot.id, slot]));
    const classes: any[] = [];
    for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
      const dayOfWeek = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
      for (const slot of slotMap.values()) {
        if (slot.dayOfWeek !== dayOfWeek) continue;
        const key = day.toISOString().slice(0, 10);
        const override = slot.overrides.find((entry) => entry.date.toISOString().slice(0, 10) === key);
        const facultyRole = role === RoleType.FACULTY || role === RoleType.HOD || role === RoleType.CLASS_INCHARGE;
        if (facultyRole && slot.facultyId !== userId && override?.substituteFacultyId !== userId) continue;
        classes.push({
          id: `${slot.id}:${key}`, slotId: slot.id, type: 'CLASS', date: key,
          title: slot.subject.name, dayOfWeek: slot.dayOfWeek, periodNumber: slot.periodNumber,
          startTime: slot.startTime, endTime: slot.endTime, roomNumber: override?.substituteRoom || slot.roomNumber,
          status: override?.type === TimetableOverrideType.CANCELLED ? 'CANCELLED' : 'SCHEDULED',
          overrideType: override?.type || null, note: override?.note || null,
          subject: { id: slot.subject.id, code: slot.subject.code, name: slot.subject.name, credits: slot.subject.credits },
          section: { id: slot.section.id, name: slot.section.name },
          faculty: override?.substituteFaculty || { id: slot.faculty.id, firstName: slot.faculty.firstName, lastName: slot.faculty.lastName },
          originalFaculty: { id: slot.faculty.id, firstName: slot.faculty.firstName, lastName: slot.faculty.lastName },
        });
      }
    }
    const calendarEvents = events.map((event) => ({
      id: event.id, type: event.type, date: event.startDate.toISOString().slice(0, 10),
      endDate: event.endDate.toISOString().slice(0, 10), title: event.title,
      description: event.description, section: event.section,
    }));
    const items = [...classes, ...calendarEvents].sort((a, b) => `${a.date}T${a.startTime || '00:00'}`.localeCompare(`${b.date}T${b.startTime || '00:00'}`));
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), items, classes, calendarEvents, todayClasses: classes.filter((item) => item.date === today), weeklyTimetable: [...slotMap.values()] };
  }
}

const timetableImportRow = z.object({
  sectionName: z.string().trim().min(1, 'Section name is required'),
  subjectCode: z.string().trim().min(1, 'Subject code is required'),
  facultyEmail: z.string().trim().email('Faculty email is invalid'),
  periodNumber: z.coerce.number().int().positive('Period number must be a positive integer'),
  dayOfWeek: z.preprocess((value) => {
    const day = String(value).trim().toLowerCase();
    const days: Record<string, number> = { monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, friday: 5, fri: 5, saturday: 6, sat: 6, sunday: 7, sun: 7 };
    return days[day] ?? Number(value);
  }, z.number().int().min(1).max(7)),
  roomNumber: z.string().trim().max(80).optional().default(''),
});

const timetableInclude = {
  subject: { select: { id: true, code: true, name: true, credits: true } },
  section: { select: { id: true, name: true } },
  faculty: { select: { id: true, firstName: true, lastName: true } },
  period: true,
} as const;

async function validateTimetableInput(institutionId: string, input: any) {
  const [section, subject, faculty, period] = await Promise.all([
    prisma.section.findFirst({ where: { id: input.sectionId, institutionId }, select: { id: true, semesterId: true } }),
    prisma.subject.findFirst({ where: { id: input.subjectId, institutionId }, select: { id: true, semesterId: true } }),
    prisma.user.findFirst({ where: { id: input.facultyId, institutionId, role: { in: [RoleType.FACULTY, RoleType.HOD, RoleType.CLASS_INCHARGE] }, isActive: true }, select: { id: true } }),
    prisma.period.findFirst({ where: { id: input.periodId, institutionId, isActive: true } }),
  ]);
  if (!section || !subject || !faculty || !period) throw new ScheduleError('Section, subject, faculty, or active period is not available in this institution', 404);
  if (section.semesterId !== subject.semesterId) throw new ScheduleError('Subject and section must belong to the same semester');
  const assignment = await prisma.facultyAssignment.findFirst({ where: { institutionId, facultyId: input.facultyId, subjectId: input.subjectId, sectionId: input.sectionId }, select: { id: true } });
  if (!assignment) throw new ScheduleError('Faculty member is not assigned to this subject and section', 403);
  return { period };
}

async function assertAvailable(institutionId: string, candidate: ScheduleSlotForClash) {
  // Read all slots on this institution/day so normalized room comparison remains
  // case-insensitive across MongoDB and PostgreSQL deployments.
  const where: any = { institutionId, dayOfWeek: candidate.dayOfWeek };
  const existing = await prisma.timetableSlot.findMany({ where, select: { id: true, dayOfWeek: true, startTime: true, endTime: true, sectionId: true, facultyId: true, roomNumber: true } });
  const clashes = findScheduleClashes(candidate, existing);
  if (clashes.length) {
    const types = [...new Set(clashes.map((clash) => clash.type))];
    throw new ScheduleError(`Schedule clash: ${types.join(', ')} already has a class during this time`, 409, clashes);
  }
}

async function requireInTenant(model: 'section', id: string, institutionId: string, label: string) {
  const found = await prisma[model].findFirst({ where: { id, institutionId }, select: { id: true } });
  if (!found) throw new ScheduleError(`${label} not found in this institution`, 404);
}

async function visibleSectionIds(institutionId: string, userId: string, role: RoleType, start: Date, end: Date): Promise<string[] | null> {
  if (role === RoleType.STUDENT) {
    const rows = await prisma.studentEnrollment.findMany({ where: { institutionId, studentId: userId, status: 'ACTIVE' }, select: { sectionId: true } });
    return [...new Set(rows.map((row) => row.sectionId))];
  }
  if (role === RoleType.FACULTY || role === RoleType.HOD || role === RoleType.CLASS_INCHARGE) {
    const [slots, substituteRows] = await Promise.all([
      prisma.timetableSlot.findMany({ where: { institutionId, facultyId: userId }, select: { sectionId: true } }),
      prisma.timetableOverride.findMany({ where: { institutionId, substituteFacultyId: userId, date: { gte: start, lte: end } }, include: { timetableSlot: { select: { sectionId: true } } } }),
    ]);
    return [...new Set([...slots.map((slot) => slot.sectionId), ...substituteRows.map((row) => row.timetableSlot.sectionId)])];
  }
  return null;
}

function atMidnight(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); }
function addDays(date: Date, days: number) { const result = new Date(date); result.setUTCDate(result.getUTCDate() + days); return result; }
function endOfDay(date: Date) { return new Date(date.getTime() + 86_400_000 - 1); }
function daysInRange(start: Date, end: Date) {
  const days = new Set<number>();
  for (let day = new Date(start); day <= end; day = addDays(day, 1)) days.add(day.getUTCDay() === 0 ? 7 : day.getUTCDay());
  return [...days];
}
async function audit(institutionId: string, actorId: string, action: string, resource: string, resourceId: string | null, details: unknown, req?: any) {
  await createAuditLog({ institutionId, userId: actorId, action, resource, resourceId, details, req });
}
