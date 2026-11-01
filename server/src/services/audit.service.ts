import { Request } from 'express';
import { prisma } from '../utils/prisma.js';

interface AuditLogOptions {
  institutionId: string;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: any;
  req?: Request;
}

export const createAuditLog = async ({
  institutionId,
  userId,
  action,
  resource,
  resourceId,
  details,
  req,
}: AuditLogOptions) => {
  try {
    const ipAddress = req?.headers['x-forwarded-for']?.toString() || req?.socket.remoteAddress || null;
    const userAgent = req?.headers['user-agent'] || null;

    return await prisma.auditLog.create({
      data: {
        institutionId,
        userId: userId ?? null,
        action,
        resource,
        resourceId: resourceId ?? null,
        details: details ?? null,
        ipAddress,
        userAgent,
      },
    });
  } catch {
    console.error('Failed to create audit log.');
  }
};
