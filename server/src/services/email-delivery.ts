export type EmailQueueStatus = 'SENT' | 'LOGGED' | 'PENDING' | 'PROCESSING' | 'FAILED';
export interface EmailQueueJobForDelivery {
  id: string;
  recipientEmail: string;
  subject: string;
  htmlBody: string;
  attempts: number;
}
export interface MailTransport {
  sendMail(message: { from: string; to: string; subject: string; html: string }): Promise<{ accepted?: Array<string | { address: string }>; rejected?: Array<string | { address: string }> }>;
}

export function shouldSendEmail(category: string, title: string, body: string, preferenceEnabled = true): boolean {
  const content = `${title} ${body}`;
  const critical = category === 'ATTENDANCE'
    || category === 'ADMIN'
    || /\bemergency\b/i.test(content)
    || /\battendance\b.{0,40}\b(shortage|shortfall|below|low)\b/i.test(content)
    || /\b(shortage|shortfall|below|low)\b.{0,40}\battendance\b/i.test(content);
  return critical || preferenceEnabled;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export async function sendQueuedEmail(
  job: EmailQueueJobForDelivery,
  options: { mode: 'log' | 'smtp'; from: string; transport?: MailTransport; logger?: (message: string) => void },
): Promise<{ logged: boolean }> {
  if (options.mode === 'log') {
    (options.logger || console.info)(`[Email Delivery: log mode] to=${job.recipientEmail} subject=${job.subject}\n${job.htmlBody}`);
    return { logged: true };
  }
  if (!options.transport) throw new Error('SMTP transport is not configured.');
  const result = await options.transport.sendMail({ from: options.from, to: job.recipientEmail, subject: job.subject, html: job.htmlBody });
  const address = (recipient: string | { address: string }) => typeof recipient === 'string' ? recipient : recipient.address;
  const accepted = (result.accepted || []).map(address).some((recipient) => recipient.toLowerCase() === job.recipientEmail.toLowerCase());
  const rejected = (result.rejected || []).map(address).some((recipient) => recipient.toLowerCase() === job.recipientEmail.toLowerCase());
  if (!accepted || rejected) throw new Error('SMTP provider did not confirm acceptance of the recipient.');
  return { logged: false };
}

export function retryDelayMs(attemptNumber: number, baseDelayMs = 30_000, maxDelayMs = 3_600_000): number {
  return Math.min(baseDelayMs * (2 ** Math.max(0, attemptNumber - 1)), maxDelayMs);
}

export async function processEmailJob(
  job: EmailQueueJobForDelivery,
  deliver: () => Promise<{ logged: boolean }>,
  persist: (update: { status: EmailQueueStatus; attempts: number; sentAt: Date | null; scheduledAt: Date; lastError: string | null }) => Promise<void>,
  options: { now?: Date; maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number; attemptAlreadyCounted?: boolean } = {},
): Promise<EmailQueueStatus> {
  const now = options.now || new Date();
  const attempts = options.attemptAlreadyCounted ? job.attempts : job.attempts + 1;
  const maxAttempts = options.maxAttempts ?? 5;
  try {
    const result = await deliver();
    const status: EmailQueueStatus = result.logged ? 'LOGGED' : 'SENT';
    await persist({ status, attempts, sentAt: result.logged ? null : now, scheduledAt: now, lastError: null });
    return status;
  } catch (error) {
    const lastError = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
    const failed = attempts >= maxAttempts;
    const scheduledAt = failed ? now : new Date(now.getTime() + retryDelayMs(attempts, options.baseDelayMs, options.maxDelayMs));
    const status: EmailQueueStatus = failed ? 'FAILED' : 'PENDING';
    await persist({ status, attempts, sentAt: null, scheduledAt, lastError });
    return status;
  }
}
