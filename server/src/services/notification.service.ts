import { NotificationCategory } from '@prisma/client';
import nodemailer, { type Transporter } from 'nodemailer';
import { prisma } from '../utils/prisma.js';
import { processEmailJob, sendQueuedEmail, shouldSendEmail, type MailTransport } from './email-delivery.js';

// Categories that CANNOT be muted per non-negotiable requirements
const UNMUTABLE_CATEGORIES: NotificationCategory[] = [
  NotificationCategory.ATTENDANCE,
  NotificationCategory.ADMIN,
];

const EMAIL_MAX_ATTEMPTS = 5;
const EMAIL_RETRY_BASE_MS = 30_000;
const EMAIL_RETRY_MAX_MS = 60 * 60 * 1000;
const EMAIL_LEASE_MS = 5 * 60 * 1000;
type EmailRuntimeConfig = { mode: 'log' | 'smtp'; provider: string; from: string; transportOptions?: Record<string, unknown> };
let cachedTransport: Transporter | undefined;
let cachedMode: 'log' | 'smtp' | undefined;

export function readEmailRuntimeConfig(env: NodeJS.ProcessEnv = process.env): EmailRuntimeConfig {
  const mode = env.EMAIL_MODE?.toLowerCase() || (env.NODE_ENV === 'production' ? 'smtp' : 'log');
  if (mode !== 'smtp' && mode !== 'log') throw new Error('EMAIL_MODE must be either "log" or "smtp".');
  if (env.NODE_ENV === 'production' && mode === 'log') {
    throw new Error('EMAIL_MODE=log is only allowed outside production; configure an SMTP provider.');
  }
  if (mode === 'log') return { mode, provider: 'log', from: env.EMAIL_FROM || 'EduSphere <no-reply@localhost>' };
  const provider = (env.EMAIL_PROVIDER || 'smtp').toLowerCase();
  if (!['smtp', 'resend', 'sendgrid'].includes(provider)) throw new Error('EMAIL_PROVIDER must be smtp, resend, or sendgrid.');
  const port = Number(env.EMAIL_SMTP_PORT || (provider === 'resend' ? 465 : 587));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('EMAIL_SMTP_PORT must be a valid port number.');
  const host = provider === 'resend' ? 'smtp.resend.com' : provider === 'sendgrid' ? 'smtp.sendgrid.net' : env.EMAIL_SMTP_HOST;
  if (!host) throw new Error('EMAIL_SMTP_HOST is required when EMAIL_MODE=smtp and EMAIL_PROVIDER=smtp.');
  const from = env.EMAIL_FROM?.trim();
  if (!from) throw new Error('EMAIL_FROM is required when EMAIL_MODE=smtp.');
  const apiKey = env.EMAIL_API_KEY;
  const user = provider === 'resend' ? 'resend' : provider === 'sendgrid' ? 'apikey' : env.EMAIL_SMTP_USER;
  const pass = provider === 'smtp' ? env.EMAIL_SMTP_PASS : apiKey;
  if (provider !== 'smtp' && !apiKey) throw new Error('EMAIL_API_KEY is required for the selected email provider.');
  if ((user && !pass) || (!user && pass)) throw new Error('Set both EMAIL_SMTP_USER and EMAIL_SMTP_PASS for SMTP authentication.');
  const secure = env.EMAIL_SMTP_SECURE ? env.EMAIL_SMTP_SECURE.toLowerCase() === 'true' : port === 465;
  return { mode, provider, from, transportOptions: { host, port, secure, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 60_000, ...(user && pass ? { auth: { user, pass } } : {}) } };
}

function runtimeTransport(config: EmailRuntimeConfig): Transporter | undefined {
  if (config.mode === 'log') return undefined;
  if (!cachedTransport || cachedMode !== config.mode) {
    cachedTransport = nodemailer.createTransport(config.transportOptions as any);
    cachedMode = config.mode;
  }
  return cachedTransport;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}


export class NotificationService {
  /**
   * Centralized trigger: createNotification
   * Delivers in-app notifications and enqueues background email delivery jobs
   */
  static async createNotification(
    institutionId: string,
    userIds: string[],
    category: NotificationCategory,
    title: string,
    body: string,
    link?: string
  ) {
    if (!userIds || userIds.length === 0) return [];

    // 1. Fetch user preferences and user emails in parallel
    const [preferences, users] = await Promise.all([
      prisma.notificationPreference.findMany({
        where: {
          institutionId,
          userId: { in: userIds },
          category,
        },
      }),
      prisma.user.findMany({
        where: {
          institutionId,
          id: { in: userIds },
          isActive: true,
        },
        select: {
          id: true,
          email: true,
        },
      }),
    ]);

    const prefMap = new Map<string, { inApp: boolean; email: boolean }>();
    for (const p of preferences) {
      prefMap.set(p.userId, { inApp: p.inAppEnabled, email: p.emailEnabled });
    }

    const isUnmutable = UNMUTABLE_CATEGORIES.includes(category);

    const inAppUserIds: string[] = [];
    const emailRecipients: string[] = [];

    for (const u of users) {
      const userPref = prefMap.get(u.id);

      // In-App check: if unmutable, always true; otherwise check user preference (default true)
      const inAppAllowed = isUnmutable ? true : userPref ? userPref.inApp : true;
      if (inAppAllowed) {
        inAppUserIds.push(u.id);
      }

      // Email check: if unmutable, always true; otherwise check user preference (default true)
      const emailAllowed = shouldSendEmail(category, title, body, userPref ? userPref.email : true);
      if (emailAllowed) {
        emailRecipients.push(u.email);
      }
    }

    // 2. Batch create in-app notifications
    const notificationCreations = inAppUserIds.map((uid) =>
      prisma.notification.create({
        data: {
          institutionId,
          userId: uid,
          category,
          title,
          body,
          link: link || null,
        },
      })
    );

    // 3. Batch enqueue background email delivery jobs
    const emailJobCreations = emailRecipients.map((email) =>
      prisma.emailJobQueue.create({
        data: {
          institutionId,
          recipientEmail: email,
          subject: `[EduSphere] ${title}`,
          htmlBody: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #4f46e5; margin-top: 0;">${escapeHtml(title)}</h2>
            <p style="font-size: 15px; line-height: 1.5;">${escapeHtml(body)}</p>
              ${
                link
                  ? `<p style="margin-top: 20px;"><a href="${escapeHtml(link)}" style="background-color: #4f46e5; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">View in EduSphere</a></p>`
                  : ''
              }
              <hr style="margin-top: 30px; border: none; border-top: 1px solid #e2e8f0;" />
              <p style="font-size: 11px; color: #64748b;">EduSphere Multi-Institution Learning Portal. Category: ${category}</p>
            </div>
          `,
        },
      })
    );

    const [createdNotifications] = await Promise.all([
      prisma.$transaction(notificationCreations),
      prisma.$transaction(emailJobCreations),
    ]);

    return createdNotifications;
  }

  /**
   * Get user notifications with unread count
   */
  static async getUserNotifications(
    institutionId: string,
    userId: string,
    unreadOnly: boolean = false,
    limit: number = 20
  ) {
    const where: any = {
      institutionId,
      userId,
    };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: {
          institutionId,
          userId,
          isRead: false,
        },
      }),
    ]);

    return { notifications, unreadCount };
  }

  /**
   * Mark single notification as read
   */
  static async markAsRead(institutionId: string, userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        institutionId,
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(institutionId: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        institutionId,
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get user notification preferences
   */
  static async getUserPreferences(institutionId: string, userId: string) {
    const existing = await prisma.notificationPreference.findMany({
      where: { institutionId, userId },
    });

    const prefMap = new Map(existing.map((e) => [e.category, e]));

    // Return complete list across all categories with defaults
    const allCategories = Object.values(NotificationCategory);
    return allCategories.map((cat) => {
      const match = prefMap.get(cat);
      const isUnmutable = UNMUTABLE_CATEGORIES.includes(cat);
      return {
        category: cat,
        inAppEnabled: isUnmutable ? true : match ? match.inAppEnabled : true,
        emailEnabled: isUnmutable ? true : match ? match.emailEnabled : true,
        isUnmutable,
      };
    });
  }

  /**
   * Update notification preferences with strict unmutable rules
   */
  static async updateUserPreferences(
    institutionId: string,
    userId: string,
    preferences: Array<{
      category: NotificationCategory;
      inAppEnabled: boolean;
      emailEnabled: boolean;
    }>
  ) {
    const ops = preferences.map((p) => {
      const isUnmutable = UNMUTABLE_CATEGORIES.includes(p.category);
      const inApp = isUnmutable ? true : p.inAppEnabled;
      const email = isUnmutable ? true : p.emailEnabled;

      return prisma.notificationPreference.upsert({
        where: {
          institutionId_userId_category: {
            institutionId,
            userId,
            category: p.category,
          },
        },
        update: {
          inAppEnabled: inApp,
          emailEnabled: email,
        },
        create: {
          institutionId,
          userId,
          category: p.category,
          inAppEnabled: inApp,
          emailEnabled: email,
        },
      });
    });

    return prisma.$transaction(ops);
  }

  static initializeEmailDelivery() {
    const config = readEmailRuntimeConfig();
    runtimeTransport(config);
    console.info(config.mode === 'log' ? '[Email Delivery] Log-only mode enabled.' : `[Email Delivery] SMTP provider configured: ${config.provider}.`);
    return { mode: config.mode, provider: config.provider };
  }

  /** Processes jobs for one tenant at a time; the claim uses SKIP LOCKED to prevent workers duplicating sends. */
  static async processEmailQueue(institutionId?: string) {
    const config = readEmailRuntimeConfig();
    const transport = runtimeTransport(config) as MailTransport | undefined;
    const institutionIds = institutionId
      ? [institutionId]
      : (await prisma.institution.findMany({ select: { id: true } })).map((institution) => institution.id);
    const result = { processed: 0, sent: 0, logged: 0, retried: 0, failed: 0 };
    for (const tenantId of institutionIds) {
      const now = new Date();
      await prisma.emailJobQueue.updateMany({
          where: { institutionId: tenantId, status: 'PROCESSING', attempts: { gte: EMAIL_MAX_ATTEMPTS }, scheduledAt: { lte: now } },
          data: { status: 'FAILED', lastError: 'Delivery worker lease expired after the maximum number of attempts.', scheduledAt: now },
        });
      // Claim one row at a time using a compare-and-set update. MongoDB updates
      // each document atomically, so concurrent workers cannot claim the same job.
      const jobs = [];
      for (let claimNumber = 0; claimNumber < 10; claimNumber += 1) {
        const candidate = await prisma.emailJobQueue.findFirst({
          where: {
            institutionId: tenantId,
            status: { in: ['PENDING', 'PROCESSING'] },
            attempts: { lt: EMAIL_MAX_ATTEMPTS },
            scheduledAt: { lte: now },
          },
          orderBy: { scheduledAt: 'asc' },
        });
        if (!candidate) break;
        const claimed = await prisma.emailJobQueue.updateMany({
          where: {
            id: candidate.id,
            institutionId: tenantId,
            status: candidate.status,
            attempts: candidate.attempts,
            scheduledAt: candidate.scheduledAt,
          },
          data: {
            status: 'PROCESSING',
            scheduledAt: new Date(now.getTime() + EMAIL_LEASE_MS),
            attempts: { increment: 1 },
          },
        });
        if (claimed.count !== 1) {
          claimNumber -= 1;
          continue;
        }
        const job = await prisma.emailJobQueue.findFirst({
          where: { id: candidate.id, institutionId: tenantId, status: 'PROCESSING' },
        });
        if (job) jobs.push(job);
      }
      result.processed += jobs.length;
      for (const job of jobs) {
        const status = await processEmailJob(job, () => sendQueuedEmail(job, { mode: config.mode, from: config.from, transport }), async (update) => {
          const saved = await prisma.emailJobQueue.updateMany({ where: { id: job.id, institutionId: tenantId, status: 'PROCESSING' }, data: update });
          if (saved.count !== 1) throw new Error('Email job claim was lost before its status could be saved.');
        }, { maxAttempts: EMAIL_MAX_ATTEMPTS, baseDelayMs: EMAIL_RETRY_BASE_MS, maxDelayMs: EMAIL_RETRY_MAX_MS, attemptAlreadyCounted: true });
        if (status === 'SENT') result.sent++;
        else if (status === 'LOGGED') result.logged++;
        else if (status === 'FAILED') result.failed++;
        else result.retried++;
      }
    }
    return result;
  }

  static async getEmailQueueHealth(institutionId: string) {
    const groups = await prisma.emailJobQueue.groupBy({ by: ['status'], where: { institutionId }, _count: { _all: true } });
    const counts = Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
    return {
      queueSize: (counts.PENDING || 0) + (counts.PROCESSING || 0),
      pending: counts.PENDING || 0,
      processing: counts.PROCESSING || 0,
      failedJobs: counts.FAILED || 0,
      sent: counts.SENT || 0,
      logged: counts.LOGGED || 0,
    };
  }
}
