import { RoleType } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

export class AdminService {
  /**
   * 1. Get Institution Settings
   */
  static async getInstitutionSettings(institutionId: string) {
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: {
        id: true,
        name: true,
        code: true,
        domain: true,
        logoUrl: true,
        defaultAttendanceThreshold: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!institution) {
      throw new Error('Institution not found');
    }

    return institution;
  }

  /**
   * 2. Update Institution Settings (with Audit Log)
   */
  static async updateInstitutionSettings(
    institutionId: string,
    data: {
      name?: string;
      defaultAttendanceThreshold?: number;
      domain?: string;
      logoUrl?: string;
    },
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const current = await prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!current) {
      throw new Error('Institution not found');
    }

    const updated = await prisma.institution.update({
      where: { id: institutionId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.defaultAttendanceThreshold !== undefined && {
          defaultAttendanceThreshold: data.defaultAttendanceThreshold,
        }),
        ...(data.domain && { domain: data.domain }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        institutionId,
        userId: actorUserId,
        action: 'UPDATE_INSTITUTION_SETTINGS',
        resource: 'institution',
        resourceId: institutionId,
        details: {
          previous: {
            name: current.name,
            defaultAttendanceThreshold: current.defaultAttendanceThreshold,
            domain: current.domain,
          },
          updated: {
            name: updated.name,
            defaultAttendanceThreshold: updated.defaultAttendanceThreshold,
            domain: updated.domain,
          },
        },
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return updated;
  }

  /**
   * 3. Get Institution Audit Logs (Strictly Scoped)
   */
  static async getAuditLogs(
    institutionId: string,
    filters?: {
      action?: string;
      resource?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { institutionId };
    if (filters?.action) where.action = filters.action;
    if (filters?.resource) where.resource = filters.resource;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.startDate || filters?.endDate) where.createdAt = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: new Date(filters.endDate.getTime() + 86_399_999) } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * 4. List Users in Institution
   */
  static async getUsers(
    institutionId: string,
    filters?: {
      role?: RoleType;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { institutionId };
    if (filters?.role) where.role = filters.role;
    if (filters?.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          mustResetPassword: true,
          createdAt: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          enrollments: {
            select: {
              rollNumber: true,
              section: {
                select: {
                  id: true,
                  name: true,
                  semester: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  /**
   * 5. Toggle User Active Status (Soft Delete / Reactivate with Audit Log)
   */
  static async toggleUserStatus(
    institutionId: string,
    userId: string,
    isActive: boolean,
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, institutionId },
    });

    if (!targetUser) {
      throw new Error('User not found in this institution');
    }
    if (targetUser.isAnonymized && isActive) throw new Error('Anonymized accounts cannot be reactivated');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive, deactivatedAt: isActive ? null : new Date() },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        institutionId,
        userId: actorUserId,
        action: isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
        resource: 'user',
        resourceId: userId,
        details: {
          targetEmail: targetUser.email,
          previousStatus: targetUser.isActive,
          newStatus: isActive,
        },
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return updated;
  }

  /**
   * 6. Get Grade Rules
   */
  static async getGradeRules(institutionId: string) {
    return prisma.gradeRule.findMany({
      where: { institutionId },
      orderBy: { minPercentage: 'desc' },
    });
  }

  /**
   * 7. Save / Configure Grade Rules
   */
  static async updateGradeRules(
    institutionId: string,
    rules: Array<{
      gradeLetter: string;
      gradePoint: number;
      minPercentage: number;
      maxPercentage: number;
      isPass: boolean;
    }>,
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const ops = rules.map((r) =>
      prisma.gradeRule.upsert({
        where: {
          institutionId_gradeLetter: {
            institutionId,
            gradeLetter: r.gradeLetter,
          },
        },
        update: {
          gradePoint: r.gradePoint,
          minPercentage: r.minPercentage,
          maxPercentage: r.maxPercentage,
          isPass: r.isPass,
        },
        create: {
          institutionId,
          gradeLetter: r.gradeLetter,
          gradePoint: r.gradePoint,
          minPercentage: r.minPercentage,
          maxPercentage: r.maxPercentage,
          isPass: r.isPass,
        },
      })
    );

    const results = await prisma.$transaction(ops);

    await prisma.auditLog.create({
      data: {
        institutionId,
        userId: actorUserId,
        action: 'UPDATE_GRADE_RULES',
        resource: 'grade_rules',
        details: { count: rules.length },
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return results;
  }
}
