import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  auth,
  registerAzubi,
  registerTrainer,
  setupTestApp,
  uniqueEmail,
  type TestContext,
} from './helpers.js';

let context: TestContext;
let app: Express;

beforeAll(async () => {
  context = await setupTestApp();
  app = context.app;
});

afterAll(async () => {
  await context.close();
});

describe('authentication', () => {
  it('registers an apprentice and returns tokens', async () => {
    const azubi = await registerAzubi(app);
    expect(azubi.user.role).toBe('AZUBI');
    expect(azubi.accessToken).toBeTruthy();

    const me = await request(app).get('/api/auth/me').set(auth(azubi.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(azubi.email);
  });

  it('rejects duplicate e-mail addresses with 409', async () => {
    const email = uniqueEmail('dup');
    await registerAzubi(app, { email });
    const response = await request(app).post('/api/auth/register').send({
      email,
      password: 'Passwort123',
      fullName: 'Doppelt',
      role: 'AZUBI',
      profession: 'Fachinformatiker',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('validates registration input with 422', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'keine-email',
      password: 'kurz',
      fullName: 'X',
      role: 'AZUBI',
    });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it('requires a profession for apprentices', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: uniqueEmail('noprof'),
      password: 'Passwort123',
      fullName: 'Ohne Beruf',
      role: 'AZUBI',
    });
    expect(response.status).toBe(422);
    expect(
      response.body.error.details.some((detail: { path: string }) => detail.path === 'profession'),
    ).toBe(true);
  });

  it('logs in with valid credentials and rejects invalid ones', async () => {
    const azubi = await registerAzubi(app);

    const good = await request(app)
      .post('/api/auth/login')
      .send({ email: azubi.email, password: azubi.password });
    expect(good.status).toBe(200);
    expect(good.body.user.id).toBe(azubi.user.id);

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: azubi.email, password: 'Falsch123' });
    expect(bad.status).toBe(401);

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('ghost'), password: 'Passwort123' });
    expect(unknown.status).toBe(401);
  });

  it('rotates refresh tokens stored in an httpOnly cookie', async () => {
    const agent = request.agent(app);
    const email = uniqueEmail('refresh');
    const register = await agent.post('/api/auth/register').send({
      email,
      password: 'Passwort123',
      fullName: 'Refresh Tester',
      role: 'AUSBILDER',
    });
    expect(register.status).toBe(201);
    const cookies = register.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((cookie) => cookie.includes('HttpOnly'))).toBe(true);

    const refreshed = await agent.post('/api/auth/refresh').send({});
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    const oldRefresh = cookies[0]!.split(';')[0]!.split('=')[1]!;
    const replay = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh });
    expect(replay.status).toBe(401);
  });

  it('logs out and invalidates the refresh token', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({
      email: uniqueEmail('logout'),
      password: 'Passwort123',
      fullName: 'Logout Tester',
      role: 'AUSBILDER',
    });
    const logout = await agent.post('/api/auth/logout').send({});
    expect(logout.status).toBe(204);

    const refresh = await agent.post('/api/auth/refresh').send({});
    expect(refresh.status).toBe(401);
  });

  it('deletes the own account and all associated data (DSGVO)', async () => {
    const azubi = await registerAzubi(app);
    const report = await request(app)
      .post('/api/reports')
      .set(auth(azubi.accessToken))
      .send({ calendarWeek: 12, year: 2026 });
    expect(report.status).toBe(201);

    const deletion = await request(app)
      .delete('/api/auth/account')
      .set(auth(azubi.accessToken));
    expect(deletion.status).toBe(204);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: azubi.email, password: azubi.password });
    expect(login.status).toBe(401);

    const reuse = await request(app).get('/api/auth/me').set(auth(azubi.accessToken));
    expect(reuse.status).toBe(401);
  });

  it('enforces role-based access control', async () => {
    const azubi = await registerAzubi(app);
    const trainer = await registerTrainer(app);

    const trainerOnly = await request(app)
      .get('/api/users/azubis')
      .set(auth(azubi.accessToken));
    expect(trainerOnly.status).toBe(403);

    const aiAsTrainer = await request(app)
      .post('/api/ai/optimize')
      .set(auth(trainer.accessToken))
      .send({ text: 'test text', category: 'BETRIEB' });
    expect(aiAsTrainer.status).toBe(403);

    const unauthenticated = await request(app).get('/api/reports');
    expect(unauthenticated.status).toBe(401);
  });

  it('links an apprentice to a trainer by e-mail', async () => {
    const trainer = await registerTrainer(app);
    const azubi = await registerAzubi(app);

    const link = await request(app)
      .post('/api/users/link-azubi')
      .set(auth(trainer.accessToken))
      .send({ email: azubi.email });
    expect(link.status).toBe(201);
    expect(link.body.azubi.id).toBe(azubi.user.id);

    const azubis = await request(app)
      .get('/api/users/azubis')
      .set(auth(trainer.accessToken));
    expect(azubis.status).toBe(200);
    expect(azubis.body.azubis).toHaveLength(1);

    const unknown = await request(app)
      .post('/api/users/link-azubi')
      .set(auth(trainer.accessToken))
      .send({ email: uniqueEmail('nobody') });
    expect(unknown.status).toBe(422);
  });

  it('returns 404 for unknown API routes', async () => {
    const response = await request(app).get('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
