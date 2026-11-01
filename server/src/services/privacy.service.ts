import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { RoleType } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

export class PrivacyError extends Error {
  constructor(message: string, public status = 400, public code?: string) {
    super(message);
  }
}

export class PrivacyService {
  static async canUseCommunity(institutionId: string, userId: string): Promise<boolean | null> {
    const user = await prisma.user.findFirst({ where: { institutionId, id: userId }, select: { isMinor: true } });
    if (!user) return null;
    if (!user.isMinor) return true;
    const consent = await prisma.guardianConsent.findFirst({
      where: { institutionId, userId }, select: { revokedAt: true },
      orderBy: { consentGivenAt: 'desc' },
    });
    return Boolean(consent && consent.revokedAt == null);
  }

  static async exportOwnData(institutionId: string, userId: string) {
    const user = await prisma.user.findFirst({
      where: { institutionId, id: userId },
      select: {
        id: true, institutionId: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, isMinor: true, isAnonymized: true, departmentId: true,
        mustResetPassword: true, createdAt: true, updatedAt: true, deactivatedAt: true,
      },
    });
    if (!user) throw new PrivacyError('Account not found.', 404);

    const institution = await prisma.institution.findFirst({
      where: { id: institutionId }, select: { id: true, name: true, code: true },
    });
    const [enrollments, facultyAssignments, attendanceRecords, attendanceSessions, attendanceCorrections,
      assessments, studentMarks, markCorrections, createdMaterials, materialViews, materialDownloads,
      materialBookmarks, classroomSessions, calendarEvents, timetableSlots, timetableOverrides, announcements, doubts,
      doubtReplies, doubtVotes, communityPosts, postLikes, postComments, pollVotes, contentReports,
      notifications, notificationPreferences, refreshSessions, guardianConsents, auditLogs] = await Promise.all([
      prisma.studentEnrollment.findMany({ where: { institutionId, studentId: userId } }),
      prisma.facultyAssignment.findMany({ where: { institutionId, facultyId: userId } }),
      prisma.attendanceRecord.findMany({ where: { institutionId, studentId: userId } }),
      prisma.attendanceSession.findMany({ where: { institutionId, facultyId: userId } }),
      prisma.attendanceCorrectionRequest.findMany({ where: { institutionId, studentId: userId } }),
      prisma.assessment.findMany({ where: { institutionId, facultyId: userId } }),
      prisma.studentMark.findMany({ where: { institutionId, studentId: userId } }),
      prisma.markCorrectionRequest.findMany({ where: { institutionId, studentId: userId } }),
      prisma.studyMaterial.findMany({ where: { institutionId, createdById: userId } }),
      prisma.materialView.findMany({ where: { institutionId, userId } }),
      prisma.materialDownload.findMany({ where: { institutionId, userId } }),
      prisma.materialBookmark.findMany({ where: { institutionId, userId } }),
      prisma.classroomSession.findMany({ where: { institutionId, facultyId: userId }, include: { pages: true } }),
      prisma.academicCalendarEvent.findMany({ where: { institutionId, createdById: userId } }),
      prisma.timetableSlot.findMany({ where: { institutionId, facultyId: userId } }),
      prisma.timetableOverride.findMany({ where: { institutionId, createdById: userId } }),
      prisma.announcement.findMany({ where: { institutionId, authorId: userId } }),
      prisma.doubt.findMany({ where: { institutionId, studentId: userId } }),
      prisma.doubtReply.findMany({ where: { institutionId, authorId: userId } }),
      prisma.doubtVote.findMany({ where: { institutionId, userId } }),
      prisma.communityPost.findMany({ where: { institutionId, authorId: userId } }),
      prisma.postLike.findMany({ where: { institutionId, userId } }),
      prisma.postComment.findMany({ where: { institutionId, authorId: userId } }),
      prisma.pollVote.findMany({ where: { institutionId, userId } }),
      prisma.contentReport.findMany({ where: { institutionId, reporterId: userId } }),
      prisma.notification.findMany({ where: { institutionId, userId } }),
      prisma.notificationPreference.findMany({ where: { institutionId, userId } }),
      prisma.refreshToken.findMany({
        where: { institutionId, userId },
        select: { id: true, createdAt: true, expiresAt: true, revokedAt: true },
      }),
      prisma.guardianConsent.findMany({
        where: { institutionId, userId }, orderBy: { consentGivenAt: 'asc' },
        select: { id: true, relationship: true, consentMethod: true, policyVersion: true, consentGivenAt: true, revokedAt: true },
      }),
      prisma.auditLog.findMany({ where: { institutionId, userId }, orderBy: { createdAt: 'asc' } }),
    ]);

    await prisma.auditLog.create({
      data: {
        institutionId, userId, action: 'USER_DATA_EXPORTED', resource: 'user', resourceId: userId,
        details: { exportVersion: 1 },
      },
    });

    return {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      profile: user,
      institution,
      education: { enrollments, attendanceRecords, attendanceCorrections, studentMarks, markCorrections },
      teaching: { facultyAssignments, attendanceSessions, assessments, createdMaterials, classroomSessions, calendarEvents, timetableSlots, timetableOverrides },
      materialsActivity: { views: materialViews, downloads: materialDownloads, bookmarks: materialBookmarks },
      community: { announcements, doubts, replies: doubtReplies, votes: doubtVotes, posts: communityPosts, likes: postLikes, comments: postComments, pollVotes, reports: contentReports },
      account: { notifications, notificationPreferences, refreshSessions, guardianConsents, auditLogs },
    };
  }

  static async anonymizeOwnAccount(institutionId: string, userId: string) {
    const existing = await prisma.user.findFirst({
      where: { institutionId, id: userId },
      select: { id: true, email: true, isAnonymized: true },
    });
    if (!existing) throw new PrivacyError('Account not found.', 404);
    if (existing.isAnonymized) return { id: userId, anonymized: true, alreadyAnonymized: true };

    const newEmail = `deleted+${randomUUID()}@anonymized.invalid`;
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // Remove user-generated community content and behavioral telemetry, while
      // retaining student enrollments, attendance, marks, and correction records.
      await tx.contentReport.deleteMany({ where: { institutionId, reporterId: userId } });
      await tx.doubtVote.deleteMany({ where: { institutionId, userId } });
      await tx.doubt.deleteMany({ where: { institutionId, studentId: userId } });
      await tx.doubtReply.deleteMany({ where: { institutionId, authorId: userId } });
      await tx.postComment.deleteMany({ where: { institutionId, authorId: userId } });
      await tx.communityPost.deleteMany({ where: { institutionId, authorId: userId } });
      await tx.announcement.deleteMany({ where: { institutionId, authorId: userId } });
      await tx.postLike.deleteMany({ where: { institutionId, userId } });
      await tx.pollVote.deleteMany({ where: { institutionId, userId } });
      await tx.materialView.deleteMany({ where: { institutionId, userId } });
      await tx.materialDownload.deleteMany({ where: { institutionId, userId } });
      await tx.materialBookmark.deleteMany({ where: { institutionId, userId } });
      await tx.notification.deleteMany({ where: { institutionId, userId } });
      await tx.notificationPreference.deleteMany({ where: { institutionId, userId } });
      await tx.refreshToken.deleteMany({ where: { institutionId, userId } });
      await tx.emailJobQueue.deleteMany({ where: { institutionId, recipientEmail: existing.email } });
      await tx.guardianConsent.updateMany({
        where: { institutionId, userId },
        data: { guardianName: 'Redacted', guardianEmail: null, revokedAt: now },
      });
      await tx.auditLog.updateMany({
        where: { institutionId, OR: [{ userId }, { resourceId: userId, resource: 'user' }] },
        data: { details: { redacted: true, reason: 'ACCOUNT_ANONYMIZATION' }, ipAddress: null, userAgent: null },
      });
      const updatedUser = await tx.user.updateMany({
        where: { id: userId, institutionId, isAnonymized: false },
        data: {
          email: newEmail, firstName: 'Anonymized', lastName: 'User', passwordHash,
          isActive: false, deactivatedAt: now, isMinor: false, isAnonymized: true,
          mustResetPassword: true, departmentId: null,
        },
      });
      if (updatedUser.count !== 1) throw new PrivacyError('Account has already been anonymized.', 409);
      await tx.auditLog.create({
        data: {
          institutionId, userId, action: 'USER_DATA_ANONYMIZED', resource: 'user', resourceId: userId,
          details: {
            academicRecordsPreserved: true,
            preserved: ['student_enrollments', 'attendance_records', 'student_marks', 'correction_requests'],
            removed: ['community_content', 'announcements', 'notifications', 'refresh_tokens', 'activity_tracking', 'guardian_contact_data'],
          },
        },
      });
    });
    return { id: userId, anonymized: true, alreadyAnonymized: false };
  }

  static async recordGuardianConsent(institutionId: string, actorId: string, userId: string, input: {
    guardianName: string; guardianEmail: string; relationship: string; consentMethod: string; policyVersion: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({ where: { institutionId, id: userId }, select: { id: true, isAnonymized: true } });
      if (!target || target.isAnonymized) throw new PrivacyError('User not found.', 404);
      await tx.user.update({ where: { institutionId, id: userId }, data: { isMinor: true } });
      await tx.guardianConsent.updateMany({
        where: { institutionId, userId, OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }] },
        data: { revokedAt: new Date() },
      });
      const consent = await tx.guardianConsent.create({ data: {
        institutionId, userId, recordedByUserId: actorId,
        guardianName: input.guardianName, guardianEmail: input.guardianEmail,
        relationship: input.relationship, consentMethod: input.consentMethod, policyVersion: input.policyVersion,
      } });
      await tx.auditLog.create({ data: {
        institutionId, userId: actorId, action: 'GUARDIAN_CONSENT_RECORDED', resource: 'guardian_consent', resourceId: consent.id,
        details: { subjectUserId: userId, relationship: input.relationship, consentMethod: input.consentMethod, policyVersion: input.policyVersion },
      } });
      return consent;
    });
  }

  static async revokeGuardianConsent(institutionId: string, actorId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({ where: { institutionId, id: userId, isAnonymized: false }, select: { id: true } });
      if (!target) throw new PrivacyError('User not found.', 404);
      const result = await tx.guardianConsent.updateMany({
        where: { institutionId, userId, OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }] },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({ data: {
        institutionId, userId: actorId, action: 'GUARDIAN_CONSENT_REVOKED', resource: 'user', resourceId: userId,
        details: { revokedRecords: result.count },
      } });
      return { userId, revokedRecords: result.count };
    });
  }

  static async setMinorStatus(institutionId: string, actorId: string, userId: string, isMinor: boolean) {
    return prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({ where: { institutionId, id: userId }, select: { id: true, isAnonymized: true, isMinor: true } });
      if (!target || target.isAnonymized) throw new PrivacyError('User not found.', 404);
      await tx.user.update({ where: { institutionId, id: userId }, data: { isMinor } });
      if (!isMinor) await tx.guardianConsent.updateMany({
        where: { institutionId, userId, OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }] },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({ data: {
        institutionId, userId: actorId, action: 'USER_MINOR_STATUS_UPDATED', resource: 'user', resourceId: userId,
        details: { previousIsMinor: target.isMinor, isMinor },
      } });
      return { id: userId, isMinor };
    });
  }

  static async getRetentionSettings(institutionId: string) {
    const settings = await prisma.institutionDataRetention.findUnique({ where: { institutionId } });
    return settings ?? {
      institutionId, inactiveAccountRetentionDays: null, auditLogRetentionDays: null, preserveAcademicRecords: true, updatedAt: null,
    };
  }

  static async updateRetentionSettings(institutionId: string, actorId: string, input: {
    inactiveAccountRetentionDays: number | null; auditLogRetentionDays: number | null;
  }) {
    const settings = await prisma.institutionDataRetention.upsert({
      where: { institutionId },
      create: { institutionId, ...input },
      update: input,
    });
    await prisma.auditLog.create({ data: {
      institutionId, userId: actorId, action: 'DATA_RETENTION_SETTINGS_UPDATED', resource: 'institution_data_retention', resourceId: settings.id,
      details: input,
    } });
    return settings;
  }

  static async runRetentionSweep(institutionId?: string, now = new Date()) {
    const institutions = institutionId
      ? [{ id: institutionId }]
      : await prisma.institution.findMany({ select: { id: true } });
    const summary = { institutions: institutions.length, anonymizedAccounts: 0, deletedAuditLogs: 0 };
    for (const institution of institutions) {
      const settings = await prisma.institutionDataRetention.findUnique({ where: { institutionId: institution.id } });
      if (!settings) continue;
      if (settings.inactiveAccountRetentionDays != null) {
        const cutoff = new Date(now.getTime() - settings.inactiveAccountRetentionDays * 86_400_000);
        const expired = await prisma.user.findMany({
          where: { institutionId: institution.id, isActive: false, isAnonymized: false, deactivatedAt: { lte: cutoff }, role: { notIn: [RoleType.ADMIN, RoleType.SUPER_ADMIN] } },
          select: { id: true },
        });
        for (const user of expired) {
          await this.anonymizeOwnAccount(institution.id, user.id);
          summary.anonymizedAccounts++;
        }
      }
      if (settings.auditLogRetentionDays != null) {
        const cutoff = new Date(now.getTime() - settings.auditLogRetentionDays * 86_400_000);
        const removed = await prisma.auditLog.deleteMany({ where: { institutionId: institution.id, createdAt: { lt: cutoff } } });
        summary.deletedAuditLogs += removed.count;
      }
    }
    return summary;
  }
}
