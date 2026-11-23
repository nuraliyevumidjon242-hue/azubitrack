import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  auth,
  binaryParser,
  createReport,
  registerAzubi,
  setupTestApp,
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

describe('DSGVO data export', () => {
  it('exports profile, reports and PDFs as a ZIP archive', async () => {
    const azubi = await registerAzubi(app);
    const report = await createReport(app, azubi, 20, 2026);
    await request(app)
      .put(`/api/reports/${report.id}`)
      .set(auth(azubi.accessToken))
      .send({
        entries: [
          { category: 'BETRIEB', content: 'Entwicklung einer neuen Funktion.', hours: 8 },
          { category: 'BERUFSSCHULE', content: 'Lernfeld 8 wiederholt.', hours: 8 },
        ],
      });

    const response = await request(app)
      .post('/api/export/data')
      .set(auth(azubi.accessToken))
      .buffer(true)
      .parse(binaryParser as never);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/zip');
    const buffer = response.body as Buffer;
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    expect(buffer.length).toBeGreaterThan(2000);

    // ZIP central directory contains our file names.
    const raw = buffer.toString('latin1');
    expect(raw).toContain('profil.json');
    expect(raw).toContain('berichte/berichte.json');
    expect(raw).toContain('Ausbildungsnachweis_KW20_2026');
  });

  it('requires authentication', async () => {
    const response = await request(app).post('/api/export/data');
    expect(response.status).toBe(401);
  });
});
