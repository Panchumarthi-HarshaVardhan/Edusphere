import { z } from 'zod';
import { RoleType } from '@prisma/client';

const id = z.string().uuid();
const text = z.string().trim().min(1).max(120);
const date = z.coerce.date();

export const institutionSetupSchema = z.object({
  body: z.object({
    name: text,
    code: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9_-]+$/),
    domain: z.string().trim().max(253).regex(/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/).optional().or(z.literal('')),
    admin: z.object({
      email: z.string().trim().email().max(254),
      firstName: text,
      lastName: text,
      departmentId: id.optional(),
    }),
  }),
});

export const entityBodySchemas = {
  departments: z.object({ name: text, code: text }),
  programs: z.object({ name: text, code: text, departmentId: id }),
  'academic-years': z.object({ name: text, startDate: date, endDate: date, isCurrent: z.boolean().optional() })
    .refine((value) => value.endDate > value.startDate, { path: ['endDate'], message: 'End date must follow start date' }),
  semesters: z.object({
    name: text,
    semesterNumber: z.coerce.number().int().positive(),
    startDate: date,
    endDate: date,
    academicYearId: id,
    programId: id,
  }).refine((value) => value.endDate > value.startDate, { path: ['endDate'], message: 'End date must follow start date' }),
  sections: z.object({ name: text, semesterId: id }),
  subjects: z.object({ name: text, code: text, semesterId: id, credits: z.coerce.number().positive().max(30).optional() }),
};
export const listEntitiesSchema = z.object({
  query: z.object({ search: z.string().trim().max(120).optional(), limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).default(0) }).passthrough(),
});
export const entityIdSchema = z.object({ params: z.object({ id }) });
export const entityPathSchema = z.object({ params: z.object({ entity: z.enum(['departments', 'programs', 'academic-years', 'semesters', 'sections', 'subjects']) }) });
export const listEntitiesWithPathSchema = z.object({
  params: z.object({ entity: z.enum(['departments', 'programs', 'academic-years', 'semesters', 'sections', 'subjects']) }),
  query: z.object({ search: z.string().trim().max(120).optional(), limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).default(0) }).passthrough(),
});
export const createUserSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(254), firstName: text, lastName: text,
    role: z.nativeEnum(RoleType).refine((role) => role !== RoleType.SUPER_ADMIN, 'Use institution setup to create a super admin'),
    departmentId: id.optional(), sectionId: id.optional(), rollNumber: z.string().trim().min(1).max(50).optional(),
    isMinor: z.boolean().optional().default(false),
  }).superRefine((user, context) => {
    if (user.role === RoleType.STUDENT && (!user.sectionId || !user.rollNumber)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['sectionId'], message: 'Students require a sectionId and rollNumber' });
    }
  }),
});
export const userIdSchema = z.object({ params: z.object({ id }) });
export const toggleStatusSchema = z.object({ params: z.object({ id }), body: z.object({ isActive: z.boolean() }) });
export const minorStatusSchema = z.object({ params: z.object({ id }), body: z.object({ isMinor: z.boolean() }) });
export const guardianConsentSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    guardianName: text,
    guardianEmail: z.string().trim().email().max(254),
    relationship: z.string().trim().min(2).max(80),
    consentMethod: z.enum(['signed_form', 'verified_email', 'in_person']),
    policyVersion: z.string().trim().min(1).max(40),
  }),
});
export const retentionSettingsSchema = z.object({ body: z.object({
  inactiveAccountRetentionDays: z.number().int().min(30).max(3650).nullable(),
  auditLogRetentionDays: z.number().int().min(30).max(3650).nullable(),
}) });
export const assignmentSchema = z.object({ body: z.object({ facultyId: id, subjectId: id, sectionId: id }) });
export const enrollmentSchema = z.object({ body: z.object({ studentId: id, sectionId: id, rollNumber: z.string().trim().min(1).max(50) }) });
export const promotionSchema = z.object({ params: z.object({ sectionId: id }), body: z.object({ targetSectionId: id }) });
export const importSchema = z.object({ params: z.object({ role: z.enum(['students', 'faculty']) }) });
export const listUserSetupSchema = z.object({
  query: z.object({
    search: z.string().trim().max(120).optional(),
    role: z.nativeEnum(RoleType).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
  }).passthrough(),
});

export const auditLogQuerySchema = z.object({ query: z.object({
  action: z.string().trim().max(120).optional(),
  resource: z.string().trim().max(120).optional(),
  userId: id.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
}).passthrough() });

export const analyticsQuerySchema = z.object({ query: z.object({
  academicYearId: id.optional(), departmentId: id.optional(), semesterId: id.optional(), sectionId: id.optional(),
  format: z.enum(['csv', 'xlsx']).optional(),
}).passthrough() });
