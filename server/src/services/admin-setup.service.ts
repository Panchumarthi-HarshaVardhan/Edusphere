import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { EnrollmentStatus, RoleType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';

type Entity = 'departments' | 'programs' | 'academic-years' | 'semesters' | 'sections' | 'subjects';
const entityModel: Record<Entity, string> = {
  departments: 'department', programs: 'program', 'academic-years': 'academicYear',
  semesters: 'semester', sections: 'section', subjects: 'subject',
};
const entityLabel: Record<Entity, string> = {
  departments: 'department', programs: 'program', 'academic-years': 'academic_year',
  semesters: 'semester', sections: 'section', subjects: 'subject',
};

const scoped = (modelName: string) => (prisma as any)[modelName];
const makeTemporaryPassword = () => `Edu-${randomBytes(12).toString('base64url')}!9`;

export class AdminSetupError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

async function ensureScoped(modelName: string, id: string, institutionId: string, label: string) {
  const value = await scoped(modelName).findFirst({ where: { id, institutionId }, select: { id: true } });
  if (!value) throw new AdminSetupError(`${label} not found in this institution`, 404);
  return value;
}

async function log(institutionId: string, actorId: string | null, action: string, resource: string, resourceId: string | null, details: unknown, req?: any) {
  await prisma.auditLog.create({ data: {
    institutionId, userId: actorId, action, resource, resourceId,
    details: details == null ? undefined : JSON.parse(JSON.stringify(details)),
    ipAddress: req?.headers?.['x-forwarded-for']?.toString() || req?.ip || req?.socket?.remoteAddress || null,
    userAgent: req?.headers?.['user-agent'] || null,
  } });
}

export class AdminSetupService {
  static async createInstitutionWithAdmin(input: {
    name: string; code: string; domain?: string; admin: { email: string; firstName: string; lastName: string };
  }, actorId: string, req?: any) {
    const password = makeTemporaryPassword();
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const institution = await prisma.$transaction(async (tx) => {
        const created = await tx.institution.create({ data: {
          name: input.name, code: input.code.toUpperCase(), domain: input.domain || null,
        } });
        const admin = await tx.user.create({ data: {
          institutionId: created.id, email: input.admin.email.toLowerCase(),
          firstName: input.admin.firstName, lastName: input.admin.lastName,
          passwordHash, role: RoleType.ADMIN, mustResetPassword: true,
        }, select: { id: true, email: true, firstName: true, lastName: true, role: true, mustResetPassword: true } });
        await tx.auditLog.create({ data: {
          institutionId: created.id, userId: actorId, action: 'CREATE_INSTITUTION', resource: 'institution', resourceId: created.id,
          details: { code: created.code, firstAdminId: admin.id, firstAdminEmail: admin.email },
          ipAddress: req?.ip || req?.socket?.remoteAddress || null, userAgent: req?.headers?.['user-agent'] || null,
        } });
        return { institution: created, admin };
      });
      return { ...institution, temporaryPassword: password };
    } catch (error: any) {
      if (error?.code === 'P2002') throw new AdminSetupError('Institution code, domain, or admin email already exists', 409);
      throw error;
    }
  }

  static async list(entity: Entity, institutionId: string, options: { search?: string; limit: number; offset: number }) {
    const modelName = entityModel[entity];
    const where: any = { institutionId };
    if (options.search) {
      const match = { contains: options.search, mode: 'insensitive' };
      where.OR = ['departments', 'programs', 'subjects'].includes(entity)
        ? [{ name: match }, { code: match }]
        : [{ name: match }];
    }
    const [items, total] = await Promise.all([
      scoped(modelName).findMany({ where, orderBy: { name: 'asc' }, take: options.limit, skip: options.offset, include: relationFor(entity) }),
      scoped(modelName).count({ where }),
    ]);
    return { items, total, limit: options.limit, offset: options.offset };
  }

  static async create(entity: Entity, institutionId: string, actorId: string, input: any, req?: any) {
    await validateEntityRelations(entity, institutionId, input);
    const modelName = entityModel[entity];
    try {
      const displacedYears = entity === 'academic-years' && input.isCurrent
        ? await prisma.academicYear.findMany({ where: { institutionId, isCurrent: true }, select: { id: true, name: true } })
        : [];
      const item = entity === 'academic-years' && input.isCurrent
        ? await prisma.$transaction(async (tx) => {
            await tx.academicYear.updateMany({ where: { institutionId, isCurrent: true }, data: { isCurrent: false } });
            return tx.academicYear.create({ data: { ...input, institutionId } });
          })
        : await scoped(modelName).create({ data: { ...input, institutionId } });
      await log(institutionId, actorId, `CREATE_${entityLabel[entity].toUpperCase()}`, entityLabel[entity], item.id, { ...input, displacedCurrentYears: displacedYears }, req);
      return item;
    } catch (error: any) {
      if (error?.code === 'P2002') throw new AdminSetupError(`${entityLabel[entity]} already exists`, 409);
      throw error;
    }
  }

  static async update(entity: Entity, institutionId: string, actorId: string, id: string, input: any, req?: any) {
    const modelName = entityModel[entity];
    const current = await scoped(modelName).findFirst({ where: { id, institutionId } });
    if (!current) throw new AdminSetupError(`${entityLabel[entity]} not found`, 404);
    await validateEntityRelations(entity, institutionId, input);
    try {
      const displacedYears = entity === 'academic-years' && input.isCurrent
        ? await prisma.academicYear.findMany({ where: { institutionId, isCurrent: true, id: { not: id } }, select: { id: true, name: true } })
        : [];
      const item = entity === 'academic-years' && input.isCurrent
        ? await prisma.$transaction(async (tx) => {
            await tx.academicYear.updateMany({ where: { institutionId, isCurrent: true, id: { not: id } }, data: { isCurrent: false } });
            return tx.academicYear.update({ where: { id, institutionId }, data: input });
          })
        : await scoped(modelName).update({ where: { id, institutionId }, data: input });
      await log(institutionId, actorId, `UPDATE_${entityLabel[entity].toUpperCase()}`, entityLabel[entity], id, { before: current, after: item, displacedCurrentYears: displacedYears }, req);
      return item;
    } catch (error: any) {
      if (error?.code === 'P2002') throw new AdminSetupError(`${entityLabel[entity]} already exists`, 409);
      throw error;
    }
  }

  static async remove(entity: Entity, institutionId: string, actorId: string, id: string, req?: any) {
    const modelName = entityModel[entity];
    const current = await scoped(modelName).findFirst({ where: { id, institutionId } });
    if (!current) throw new AdminSetupError(`${entityLabel[entity]} not found`, 404);
    await ensureDeleteSafe(entity, institutionId, id);
    try {
      await scoped(modelName).delete({ where: { id, institutionId } });
      await log(institutionId, actorId, `DELETE_${entityLabel[entity].toUpperCase()}`, entityLabel[entity], id, current, req);
      return { id };
    } catch (error: any) {
      if (error?.code === 'P2003') throw new AdminSetupError('Cannot delete a record that is in use', 409);
      throw error;
    }
  }

  static async createUser(institutionId: string, actorId: string, input: any, req?: any) {
    if (input.departmentId) await ensureScoped('department', input.departmentId, institutionId, 'Department');
    if (input.sectionId) await ensureScoped('section', input.sectionId, institutionId, 'Section');
    const temporaryPassword = makeTemporaryPassword();
    const data: any = {
      institutionId, email: input.email.toLowerCase(), firstName: input.firstName, lastName: input.lastName,
      role: input.role, departmentId: input.departmentId || null,
      isMinor: input.isMinor ?? false,
      passwordHash: await bcrypt.hash(temporaryPassword, 12), mustResetPassword: true,
    };
    try {
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data, select: { id: true, institutionId: true, email: true, firstName: true, lastName: true, role: true, departmentId: true, mustResetPassword: true, isActive: true } });
        if (input.role === RoleType.STUDENT) {
          await tx.studentEnrollment.create({ data: { institutionId, studentId: created.id, sectionId: input.sectionId, rollNumber: input.rollNumber } });
        }
        return created;
      });
      await log(institutionId, actorId, 'CREATE_USER', 'user', user.id, { email: user.email, role: user.role, sectionId: input.sectionId || null }, req);
      return { user, temporaryPassword };
    } catch (error: any) {
      if (error?.code === 'P2002') throw new AdminSetupError('Email or roll number already exists in this institution', 409);
      throw error;
    }
  }

  static async setUserStatus(institutionId: string, actorId: string, id: string, isActive: boolean, req?: any) {
    const user = await prisma.user.findFirst({ where: { id, institutionId } });
    if (!user) throw new AdminSetupError('User not found', 404);
    if (user.isAnonymized && isActive) throw new AdminSetupError('Anonymized accounts cannot be reactivated', 409);
    const updated = await prisma.user.update({ where: { id, institutionId }, data: { isActive, deactivatedAt: isActive ? null : new Date() }, select: { id: true, email: true, isActive: true } });
    await log(institutionId, actorId, isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED', 'user', id, { previousStatus: user.isActive, newStatus: isActive }, req);
    return updated;
  }

  static async resetUserPassword(institutionId: string, actorId: string, id: string, req?: any) {
    const user = await prisma.user.findFirst({ where: { id, institutionId }, select: { id: true, isAnonymized: true } });
    if (!user) throw new AdminSetupError('User not found', 404);
    if (user.isAnonymized) throw new AdminSetupError('Anonymized accounts cannot be reset', 409);
    const temporaryPassword = makeTemporaryPassword();
    await prisma.user.update({ where: { id, institutionId }, data: { passwordHash: await bcrypt.hash(temporaryPassword, 12), mustResetPassword: true } });
    await prisma.refreshToken.updateMany({ where: { institutionId, userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await log(institutionId, actorId, 'ADMIN_PASSWORD_RESET', 'user', id, { forcedReset: true }, req);
    return { temporaryPassword };
  }

  static async assignFaculty(institutionId: string, actorId: string, input: any, req?: any) {
    const [faculty, subject, section] = await Promise.all([
      prisma.user.findFirst({ where: { id: input.facultyId, institutionId }, select: { id: true, role: true } }),
      prisma.subject.findFirst({ where: { id: input.subjectId, institutionId }, select: { id: true, semesterId: true } }),
      prisma.section.findFirst({ where: { id: input.sectionId, institutionId }, select: { id: true, semesterId: true } }),
    ]);
    if (!faculty || !(faculty.role === RoleType.FACULTY || faculty.role === RoleType.CLASS_INCHARGE)) throw new AdminSetupError('Faculty not found in this institution', 404);
    if (!subject || !section) throw new AdminSetupError('Subject or section not found in this institution', 404);
    if (subject.semesterId !== section.semesterId) throw new AdminSetupError('Subject and section must belong to the same semester', 400);
    try {
      const assignment = await prisma.facultyAssignment.create({ data: { institutionId, ...input } });
      await log(institutionId, actorId, 'ASSIGN_FACULTY', 'faculty_assignment', assignment.id, input, req);
      return assignment;
    } catch (error: any) {
      if (error?.code === 'P2002') throw new AdminSetupError('Faculty is already assigned to this subject and section', 409);
      throw error;
    }
  }

  static async listAssignments(institutionId: string) {
    return prisma.facultyAssignment.findMany({ where: { institutionId }, include: { faculty: { select: { id: true, email: true, firstName: true, lastName: true } }, subject: { select: { id: true, name: true, code: true } }, section: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
  }

  static async enrollStudent(institutionId: string, actorId: string, input: any, req?: any) {
    const [student, section] = await Promise.all([
      prisma.user.findFirst({ where: { id: input.studentId, institutionId, role: RoleType.STUDENT }, select: { id: true } }),
      prisma.section.findFirst({ where: { id: input.sectionId, institutionId }, select: { id: true } }),
    ]);
    if (!student || !section) throw new AdminSetupError('Student or section not found in this institution', 404);
    try {
      const enrollment = await prisma.studentEnrollment.upsert({
        where: { institutionId_sectionId_studentId: { institutionId, sectionId: input.sectionId, studentId: input.studentId } },
        update: { rollNumber: input.rollNumber, status: EnrollmentStatus.ACTIVE },
        create: { institutionId, ...input },
      });
      await log(institutionId, actorId, 'ENROLL_STUDENT', 'student_enrollment', enrollment.id, input, req);
      return enrollment;
    } catch (error: any) {
      if (error?.code === 'P2002') throw new AdminSetupError('Roll number already exists in this institution', 409);
      throw error;
    }
  }

  static async promoteSection(institutionId: string, actorId: string, sourceSectionId: string, targetSectionId: string, req?: any) {
    if (sourceSectionId === targetSectionId) throw new AdminSetupError('Choose a different target section');
    const [source, target] = await Promise.all([
      prisma.section.findFirst({ where: { id: sourceSectionId, institutionId }, include: { semester: { include: { academicYear: true } } } }),
      prisma.section.findFirst({ where: { id: targetSectionId, institutionId }, include: { semester: { include: { academicYear: true } } } }),
    ]);
    if (!source || !target) throw new AdminSetupError('Source or target section not found in this institution', 404);
    if (source.semester.programId !== target.semester.programId || target.semester.academicYear.startDate <= source.semester.academicYear.startDate) {
      throw new AdminSetupError('Target section must be in the same program in a later academic year');
    }
    const active = await prisma.studentEnrollment.findMany({ where: { institutionId, sectionId: sourceSectionId, status: EnrollmentStatus.ACTIVE }, orderBy: { rollNumber: 'asc' } });
    const yearTag = target.semester.academicYear.name.replace(/[^A-Za-z0-9]/g, '').slice(-4) || 'NEXT';
    const promoted = await prisma.$transaction(async (tx) => {
      const outcomes = [];
      for (let index = 0; index < active.length; index += 1) {
        const enrollment = active[index];
        const exists = await tx.studentEnrollment.findFirst({ where: { institutionId, sectionId: targetSectionId, studentId: enrollment.studentId } });
        if (exists) {
          await tx.studentEnrollment.update({ where: { id: enrollment.id, institutionId }, data: { status: EnrollmentStatus.COMPLETED } });
          continue;
        }
        let suffix = index + 1;
        let rollNumber = `${yearTag}-${String(suffix).padStart(3, '0')}`;
        while (await tx.studentEnrollment.findFirst({ where: { institutionId, rollNumber }, select: { id: true } })) {
          suffix += 1;
          rollNumber = `${yearTag}-${String(suffix).padStart(3, '0')}`;
        }
        const nextEnrollment = await tx.studentEnrollment.create({ data: { institutionId, studentId: enrollment.studentId, sectionId: targetSectionId, rollNumber } });
        await tx.studentEnrollment.update({ where: { id: enrollment.id, institutionId }, data: { status: EnrollmentStatus.COMPLETED } });
        outcomes.push(nextEnrollment);
      }
      return outcomes;
    });
    await log(institutionId, actorId, 'PROMOTE_SECTION', 'section', sourceSectionId, { targetSectionId, promotedCount: promoted.length }, req);
    return { promotedCount: promoted.length, enrollments: promoted };
  }

  static async importRows(institutionId: string, actorId: string, role: 'students' | 'faculty', rows: Array<{ rowNumber: number; data: Record<string, string> }>, req?: any) {
    const results: Array<{ rowNumber: number; status: 'imported' | 'error'; email?: string; temporaryPassword?: string; errors?: string[] }> = [];
    for (const row of rows) {
      const rowSchema = z.object({
        email: z.string().trim().email().max(254), firstName: z.string().trim().min(1).max(120),
        lastName: z.string().trim().min(1).max(120), departmentId: z.string().uuid().optional().or(z.literal('')),
        ...(role === 'students' ? { sectionId: z.string().uuid(), rollNumber: z.string().trim().min(1).max(50) } : {}),
      });
      const parsed = rowSchema.safeParse(row.data);
      const email = row.data.email?.trim().toLowerCase();
      if (!parsed.success) {
        results.push({ rowNumber: row.rowNumber, status: 'error', email, errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) });
        continue;
      }
      const valid = parsed.data;
      try {
        const result = await this.createUser(institutionId, actorId, {
          email: valid.email.toLowerCase(), firstName: valid.firstName, lastName: valid.lastName,
          role: role === 'students' ? RoleType.STUDENT : RoleType.FACULTY,
          departmentId: valid.departmentId || undefined,
          sectionId: role === 'students' ? (valid as any).sectionId : undefined,
          rollNumber: role === 'students' ? (valid as any).rollNumber : undefined,
        }, req);
        results.push({ rowNumber: row.rowNumber, status: 'imported', email: result.user.email, temporaryPassword: result.temporaryPassword });
      } catch (error: any) {
        results.push({ rowNumber: row.rowNumber, status: 'error', email, errors: [error.message || 'Import failed'] });
      }
    }
    await log(institutionId, actorId, 'BULK_IMPORT_USERS', 'user', null, { role, rowCount: rows.length, importedCount: results.filter((r) => r.status === 'imported').length, errorCount: results.filter((r) => r.status === 'error').length }, req);
    return { results, total: rows.length, imported: results.filter((r) => r.status === 'imported').length, failed: results.filter((r) => r.status === 'error').length };
  }
}

function relationFor(entity: Entity): any {
  if (entity === 'programs') return { department: { select: { id: true, name: true, code: true } } };
  if (entity === 'semesters') return { academicYear: { select: { id: true, name: true, startDate: true, endDate: true } }, program: { select: { id: true, name: true, code: true } } };
  if (entity === 'sections') return { semester: { select: { id: true, name: true, semesterNumber: true, programId: true, academicYear: { select: { id: true, name: true, startDate: true } }, program: { select: { id: true, name: true } } } } };
  if (entity === 'subjects') return { semester: { select: { id: true, name: true, semesterNumber: true, program: { select: { id: true, name: true } } } } };
  return undefined;
}

async function validateEntityRelations(entity: Entity, institutionId: string, input: any) {
  if (entity === 'programs' && input.departmentId) await ensureScoped('department', input.departmentId, institutionId, 'Department');
  if (entity === 'semesters') {
    if (input.academicYearId) await ensureScoped('academicYear', input.academicYearId, institutionId, 'Academic year');
    if (input.programId) await ensureScoped('program', input.programId, institutionId, 'Program');
  }
  if ((entity === 'sections' || entity === 'subjects') && input.semesterId) await ensureScoped('semester', input.semesterId, institutionId, 'Semester');
}

async function ensureDeleteSafe(entity: Entity, institutionId: string, id: string) {
  const checks: Array<Promise<number>> = [];
  if (entity === 'departments') {
    checks.push(prisma.program.count({ where: { institutionId, departmentId: id } }), prisma.user.count({ where: { institutionId, departmentId: id } }));
  } else if (entity === 'programs') {
    checks.push(prisma.semester.count({ where: { institutionId, programId: id } }));
  } else if (entity === 'academic-years') {
    checks.push(prisma.semester.count({ where: { institutionId, academicYearId: id } }));
  } else if (entity === 'semesters') {
    checks.push(prisma.section.count({ where: { institutionId, semesterId: id } }), prisma.subject.count({ where: { institutionId, semesterId: id } }));
  } else if (entity === 'sections') {
    checks.push(
      prisma.studentEnrollment.count({ where: { institutionId, sectionId: id } }),
      prisma.facultyAssignment.count({ where: { institutionId, sectionId: id } }),
      prisma.attendanceSession.count({ where: { institutionId, sectionId: id } }),
      prisma.assessment.count({ where: { institutionId, sectionId: id } }),
      prisma.classroomSession.count({ where: { institutionId, sectionId: id } }),
      prisma.timetableSlot.count({ where: { institutionId, sectionId: id } }),
      prisma.communityPost.count({ where: { institutionId, sectionId: id } }),
      prisma.materialTargetSection.count({ where: { sectionId: id, studyMaterial: { institutionId } } }),
    );
  } else if (entity === 'subjects') {
    checks.push(
      prisma.facultyAssignment.count({ where: { institutionId, subjectId: id } }),
      prisma.studyMaterial.count({ where: { institutionId, subjectId: id } }),
      prisma.attendanceSession.count({ where: { institutionId, subjectId: id } }),
      prisma.assessment.count({ where: { institutionId, subjectId: id } }),
      prisma.classroomSession.count({ where: { institutionId, subjectId: id } }),
      prisma.unit.count({ where: { institutionId, subjectId: id } }),
      prisma.doubt.count({ where: { institutionId, subjectId: id } }),
      prisma.timetableSlot.count({ where: { institutionId, subjectId: id } }),
    );
  }
  if ((await Promise.all(checks)).some((count) => count > 0)) {
    throw new AdminSetupError('Cannot delete a record that has dependent academic data', 409);
  }
}
