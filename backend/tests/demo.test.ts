import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { auth, setupTestApp, type TestContext } from './helpers.js';

let context: TestContext;
let app: Express;

beforeAll(async () => {
  context = await setupTestApp();
  app = context.app;
});

afterAll(async () => {
  await context.close();
});

describe('demo mode', () => {
  it('starts a one-click demo session with seeded data', async () => {
    const response = await request(app).post('/api/auth/demo').send({});
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('AZUBI');
    expect(response.body.user.isDemo).toBe(true);
    expect(response.body.demoSessionId).toBeTruthy();
    expect(response.body.demoUsers).toHaveLength(3);

    const reports = await request(app)
      .get('/api/reports')
      .set(auth(response.body.accessToken));
    expect(reports.status).toBe(200);
    expect(reports.body.reports.length).toBeGreaterThanOrEqual(6);

    const statuses = reports.body.reports.map((report: { status: string }) => report.status);
    expect(statuses).toContain('FREIGEGEBEN');
    expect(statuses).toContain('EINGEREICHT');
    expect(statuses).toContain('ENTWURF');
  });

  it('switches to the trainer perspective within the same demo session', async () => {
    const azubiSession = await request(app).post('/api/auth/demo').send({ role: 'AZUBI' });
    const trainerSession = await request(app)
      .post('/api/auth/demo')
      .send({ role: 'AUSBILDER', sessionId: azubiSession.body.demoSessionId });

    expect(trainerSession.status).toBe(200);
    expect(trainerSession.body.user.role).toBe('AUSBILDER');
    expect(trainerSession.body.user.isDemo).toBe(true);

    const azubis = await request(app)
      .get('/api/users/azubis')
      .set(auth(trainerSession.body.accessToken));
    expect(azubis.status).toBe(200);
    expect(azubis.body.azubis).toHaveLength(2);
    expect(azubis.body.azubis[0].reports.length).toBeGreaterThan(0);
  });

  it('rejects unknown or expired demo sessions', async () => {
    const response = await request(app)
      .post('/api/auth/demo')
      .send({ role: 'AZUBI', sessionId: 'does-not-exist-session' });
    expect(response.status).toBe(401);
  });

  it('does not allow password login for demo accounts', async () => {
    const demo = await request(app).post('/api/auth/demo').send({});
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: demo.body.user.email, password: 'beliebig123' });
    expect(login.status).toBe(401);
  });
});
