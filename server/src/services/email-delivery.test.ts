import test from 'node:test';
import assert from 'node:assert/strict';
import { processEmailJob, retryDelayMs, sendQueuedEmail, shouldSendEmail, type EmailQueueJobForDelivery, type MailTransport } from './email-delivery.js';
import { readEmailRuntimeConfig } from './notification.service.js';

const job: EmailQueueJobForDelivery = { id: 'job-1', recipientEmail: 'person@example.test', subject: 'Notice', htmlBody: '<p>Notice</p>', attempts: 0 };

test('sends with a mocked SMTP transport and records SENT only after provider acceptance', async () => {
  let sentMessage: any;
  let persisted: any;
  const transport: MailTransport = { sendMail: async (message) => { sentMessage = message; return { accepted: ['person@example.test'], rejected: [] }; } };
  const status = await processEmailJob(job, () => sendQueuedEmail(job, { mode: 'smtp', from: 'EduSphere <noreply@example.test>', transport }), async (update) => { persisted = update; }, { now: new Date('2026-01-01T00:00:00Z') });
  assert.equal(status, 'SENT');
  assert.equal(persisted.status, 'SENT');
  assert.equal(persisted.sentAt.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(sentMessage.to, job.recipientEmail);
});

test('does not mark a job sent when SMTP does not accept the recipient and schedules exponential retry', async () => {
  let persisted: any;
  const transport: MailTransport = { sendMail: async () => ({ accepted: [], rejected: ['person@example.test'] }) };
  const now = new Date('2026-01-01T00:00:00Z');
  const status = await processEmailJob(job, () => sendQueuedEmail(job, { mode: 'smtp', from: 'noreply@example.test', transport }), async (update) => { persisted = update; }, { now });
  assert.equal(status, 'PENDING');
  assert.equal(persisted.sentAt, null);
  assert.equal(persisted.attempts, 1);
  assert.equal(persisted.scheduledAt.getTime(), now.getTime() + 30_000);
  assert.match(persisted.lastError, /did not confirm acceptance/);
  assert.equal(retryDelayMs(2), 60_000);
});

test('moves a job to FAILED and retains the provider error after the attempt cap', async () => {
  let persisted: any;
  const retryJob = { ...job, attempts: 4 };
  const status = await processEmailJob(retryJob, async () => { throw new Error('provider unavailable'); }, async (update) => { persisted = update; }, { now: new Date('2026-01-01T00:00:00Z'), maxAttempts: 5 });
  assert.equal(status, 'FAILED');
  assert.equal(persisted.status, 'FAILED');
  assert.equal(persisted.attempts, 5);
  assert.equal(persisted.lastError, 'provider unavailable');
  assert.equal(persisted.sentAt, null);
});

test('dev log mode logs instead of sending or marking a job as provider-sent', async () => {
  const logs: string[] = [];
  let persisted: any;
  const status = await processEmailJob(job, () => sendQueuedEmail(job, { mode: 'log', from: '', logger: (message) => logs.push(message) }), async (update) => { persisted = update; });
  assert.equal(status, 'LOGGED');
  assert.equal(persisted.sentAt, null);
  assert.equal(persisted.status, 'LOGGED');
  assert.match(logs[0], /person@example.test/);
});

test('respects email preferences except for attendance and emergency alerts', () => {
  assert.equal(shouldSendEmail('COMMUNITY', 'New post', 'Body', false), false);
  assert.equal(shouldSendEmail('ATTENDANCE', 'Attendance shortage', 'Below threshold', false), true);
  assert.equal(shouldSendEmail('ACADEMIC', 'Attendance shortage alert', 'Your attendance is below the required threshold', false), true);
  assert.equal(shouldSendEmail('ACADEMIC', 'Campus alert', 'Emergency maintenance notice', false), true);
});

test('defaults development to log mode and resolves provider SMTP settings from environment', () => {
  assert.equal(readEmailRuntimeConfig({ NODE_ENV: 'development' }).mode, 'log');
  const resend = readEmailRuntimeConfig({ NODE_ENV: 'production', EMAIL_MODE: 'smtp', EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'test-key', EMAIL_FROM: 'alerts@example.test' });
  assert.equal(resend.mode, 'smtp');
  assert.deepEqual(resend.transportOptions?.host, 'smtp.resend.com');
  assert.throws(() => readEmailRuntimeConfig({ NODE_ENV: 'production', EMAIL_MODE: 'smtp', EMAIL_PROVIDER: 'smtp', EMAIL_FROM: 'alerts@example.test' }), /EMAIL_SMTP_HOST/);
});

test('rejects email log mode in production to avoid logging message contents', () => {
  assert.throws(
    () => readEmailRuntimeConfig({ NODE_ENV: 'production', EMAIL_MODE: 'log' }),
    /only allowed outside production/
  );
});
