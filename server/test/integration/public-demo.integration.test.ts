import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { prisma } from '../../src/utils/prisma.js';

const validRequest = {
  name: 'Taylor Morgan',
  institution: 'North Valley College',
  role: 'Administrator',
  email: 'Taylor@northvalley.edu',
  message: 'Please show us how academic setup and learning materials work.',
  website: '',
};

describe('public demo requests', () => {
  beforeEach(async () => {
    await prisma.demoRequest.deleteMany({});
  });

  afterAll(async () => {
    await prisma.demoRequest.deleteMany({});
    await prisma.$disconnect();
  });

  it('accepts a valid unauthenticated request and stores it', async () => {
    const response = await request(app).post('/api/public/demo-requests').send(validRequest);

    expect(response.status).toBe(201);
    expect(response.body.message).toMatch(/thanks/i);
    const stored = await prisma.demoRequest.findFirst({ where: { email: 'taylor@northvalley.edu' } });
    expect(stored).toMatchObject({
      contactName: 'Taylor Morgan',
      institutionName: 'North Valley College',
      role: 'Administrator',
      email: 'taylor@northvalley.edu',
    });
  });

  it('rejects invalid fields before storing a request', async () => {
    const response = await request(app).post('/api/public/demo-requests').send({
      ...validRequest, email: 'not-an-email', message: 'short',
    });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'body.email' }),
      expect.objectContaining({ field: 'body.message' }),
    ]));
    expect(await prisma.demoRequest.count()).toBe(0);
  });

  it('silently accepts honeypot submissions without saving them', async () => {
    const response = await request(app).post('/api/public/demo-requests').send({ ...validRequest, website: 'spam.example' });

    expect(response.status).toBe(202);
    expect(response.body.message).toMatch(/thanks/i);
    expect(await prisma.demoRequest.count()).toBe(0);
  });

  it('rate limits repeat requests', async () => {
    const client = request(app);
    let lastResponse;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      lastResponse = await client.post('/api/public/demo-requests')
        .set('x-test-rate-limit-key', 'demo-rate-limit-case')
        .send(validRequest);
    }

    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.body.message).toMatch(/too many/i);
  });
});
