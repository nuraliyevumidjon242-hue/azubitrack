import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  auth,
  binaryParser,
  createReport,
  linkAzubi,
  registerAzubi,
  registerTrainer,
  setupTestApp,
  type RegisteredUser,
  type TestContext,
} from './helpers.js';

let context: TestContext;
let app: Express;
let azubi: RegisteredUser;
let trainer: RegisteredUser;
let reportId: string;

const ENTRIES = [
  {
    category: 'BETRIEB',
    content:
      'Entwicklung eines neuen REST-API-Endpunkts inklusive Validierung der Eingabeparameter.',
    hours: 8,
  },
  {
    category: 'BETRIEB',
    content: 'Durchführung von Unit-Tests und Dokumentation der Testergebnisse.',
    hours: 4,
  },
  {
    category: 'UNTERWEISUNG',
    content: 'Interne Schulung zu Clean-Code-Prinzipien besucht.',
    hours: 4,
  },
  {
    category: 'BERUFSSCHULE',
    content: 'Berufsschule: Lernfeld 8 – Daten systemübergreifend bereitstellen.',
    hours: 8,
  },
];

beforeAll(async () => {
  context = await setupTestApp();
  app = context.app;
  azubi = await registerAzubi(app);
  trainer = await registerTrainer(app);
  await linkAzubi(app, trainer, azubi.email);
  const report = await createReport(app, azubi, 10, 2026);
  reportId = report.id;
});

afterAll(async () => {
  await context.close();
});

describe('report lifecycle', () => {
  it('creates a draft report', async () => {
    const response = await request(app)
      .get(`/api/reports/${reportId}`)
      .set(auth(azubi.accessToken));
    expect(response.status).toBe(200);
    expect(response.body.report.status).toBe('ENTWURF');
    expect(response.body.report.entries).toHaveLength(0);
    expect(response.body.report.azubi.id).toBe(azubi.user.id);
    expect(response.body.report.ausbilder.id).toBe(trainer.user.id);
  });

  it('rejects duplicate reports for the same week with 409', async () => {
    const response = await request(app)
      .post('/api/reports')
      .set(auth(azubi.accessToken))
      .send({ calendarWeek: 10, year: 2026 });
    expect(response.status).toBe(409);
    expect(response.body.error.details.reportId).toBe(reportId);
  });

  it('rejects non-existent calendar weeks with 422', async () => {
    const response = await request(app)
      .post('/api/reports')
      .set(auth(azubi.accessToken))
      .send({ calendarWeek: 53, year: 2025 });
    expect(response.status).toBe(422);
  });

  it('saves entries and calculates totals', async () => {
    const response = await request(app)
      .put(`/api/reports/${reportId}`)
      .set(auth(azubi.accessToken))
      .send({ entries: ENTRIES });
    expect(response.status).toBe(200);
    expect(response.body.report.entries).toHaveLength(4);
    expect(response.body.report.totalHours).toBe(24);
    expect(response.body.report.hoursByCategory).toEqual({
      BETRIEB: 12,
      UNTERWEISUNG: 4,
      BERUFSSCHULE: 8,
    });
    expect(response.body.report.entryCount).toBe(4);
  });

  it('validates entry input', async () => {
    const response = await request(app)
      .put(`/api/reports/${reportId}`)
      .set(auth(azubi.accessToken))
      .send({ entries: [{ category: 'BETRIEB', content: '   ', hours: 8 }] });
    expect(response.status).toBe(422);

    const badCategory = await request(app)
      .put(`/api/reports/${reportId}`)
      .set(auth(azubi.accessToken))
      .send({ entries: [{ category: 'FREIZEIT', content: 'Test', hours: 8 }] });
    expect(badCategory.status).toBe(422);

    const negativeHours = await request(app)
      .put(`/api/reports/${reportId}`)
      .set(auth(azubi.accessToken))
      .send({ entries: [{ category: 'BETRIEB', content: 'Test', hours: -2 }] });
    expect(negativeHours.status).toBe(422);
  });

  it('prevents other apprentices from reading the report', async () => {
    const stranger = await registerAzubi(app);
    const response = await request(app)
      .get(`/api/reports/${reportId}`)
      .set(auth(stranger.accessToken));
    expect(response.status).toBe(403);
  });

  it('prevents unassigned trainers from reading or reviewing', async () => {
    const strangerTrainer = await registerTrainer(app);
    const read = await request(app)
      .get(`/api/reports/${reportId}`)
      .set(auth(strangerTrainer.accessToken));
    expect(read.status).toBe(403);

    const review = await request(app)
      .patch(`/api/reports/${reportId}/review`)
      .set(auth(strangerTrainer.accessToken))
      .send({ decision: 'FREIGEGEBEN' });
    expect(review.status).toBe(403);
  });

  it('prevents trainers from editing report content', async () => {
    const response = await request(app)
      .put(`/api/reports/${reportId}`)
      .set(auth(trainer.accessToken))
      .send({ entries: ENTRIES });
    expect(response.status).toBe(403);
  });

  it('refuses submission without entries', async () => {
    const empty = await createReport(app, azubi, 11, 2026);
    const response = await request(app)
      .patch(`/api/reports/${empty.id}/submit`)
      .set(auth(azubi.accessToken));
    expect(response.status).toBe(422);
  });

  it('submits the report and locks editing', async () => {
    const submit = await request(app)
      .patch(`/api/reports/${reportId}/submit`)
      .set(auth(azubi.accessToken));
    expect(submit.status).toBe(200);
    expect(submit.body.report.status).toBe('EINGEREICHT');
    expect(submit.body.report.submittedAt).toBeTruthy();

    const edit = await request(app)
      .put(`/api/reports/${reportId}`)
      .set(auth(azubi.accessToken))
      .send({ entries: ENTRIES });
    expect(edit.status).toBe(409);

    const secondSubmit = await request(app)
      .patch(`/api/reports/${reportId}/submit`)
      .set(auth(azubi.accessToken));
    expect(secondSubmit.status).toBe(409);
  });

  it('lists reports for the apprentice and the trainer', async () => {
    const own = await request(app).get('/api/reports').set(auth(azubi.accessToken));
    expect(own.status).toBe(200);
    expect(own.body.reports.some((report: { id: string }) => report.id === reportId)).toBe(true);

    const trainerList = await request(app)
      .get('/api/reports')
      .set(auth(trainer.accessToken));
    expect(trainerList.status).toBe(200);
    expect(
      trainerList.body.reports.some((report: { id: string }) => report.id === reportId),
    ).toBe(true);

    const filtered = await request(app)
      .get(`/api/reports?azubiId=${azubi.user.id}`)
      .set(auth(trainer.accessToken));
    expect(filtered.status).toBe(200);
    expect(filtered.body.reports.length).toBeGreaterThan(0);
  });

  it('requires a comment when rejecting', async () => {
    const response = await request(app)
      .patch(`/api/reports/${reportId}/review`)
      .set(auth(trainer.accessToken))
      .send({ decision: 'ABGELEHNT' });
    expect(response.status).toBe(422);
    expect(
      response.body.error.details.some((detail: { path: string }) => detail.path === 'comment'),
    ).toBe(true);
  });

  it('rejects the report with a comment', async () => {
    const response = await request(app)
      .patch(`/api/reports/${reportId}/review`)
      .set(auth(trainer.accessToken))
      .send({ decision: 'ABGELEHNT', comment: 'Bitte die Berufsschulthemen konkretisieren.' });
    expect(response.status).toBe(200);
    expect(response.body.report.status).toBe('ABGELEHNT');
    expect(response.body.report.ausbilderComment).toBe(
      'Bitte die Berufsschulthemen konkretisieren.',
    );
    expect(response.body.report.reviewedAt).toBeTruthy();
  });

  it('allows editing and resubmitting a rejected report', async () => {
    const edit = await request(app)
      .put(`/api/reports/${reportId}`)
      .set(auth(azubi.accessToken))
      .send({ entries: ENTRIES });
    expect(edit.status).toBe(200);

    const resubmit = await request(app)
      .patch(`/api/reports/${reportId}/submit`)
      .set(auth(azubi.accessToken));
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.report.status).toBe('EINGEREICHT');
  });

  it('approves the report and stores signature metadata', async () => {
    const response = await request(app)
      .patch(`/api/reports/${reportId}/review`)
      .set(auth(trainer.accessToken))
      .send({ decision: 'FREIGEGEBEN', comment: 'Sieht gut aus.' });
    expect(response.status).toBe(200);
    expect(response.body.report.status).toBe('FREIGEGEBEN');
    expect(response.body.report.approvedAt).toBeTruthy();
    expect(response.body.report.approvalSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('locks the report permanently after approval', async () => {
    const edit = await request(app)
      .put(`/api/reports/${reportId}`)
      .set(auth(azubi.accessToken))
      .send({ entries: ENTRIES });
    expect(edit.status).toBe(409);

    const reviewAgain = await request(app)
      .patch(`/api/reports/${reportId}/review`)
      .set(auth(trainer.accessToken))
      .send({ decision: 'ABGELEHNT', comment: 'Zu spät.' });
    expect(reviewAgain.status).toBe(409);
  });

  it('generates an IHK-compliant PDF for apprentice and trainer', async () => {
    const pdf = await request(app)
      .get(`/api/reports/${reportId}/pdf`)
      .set(auth(azubi.accessToken))
      .buffer(true)
      .parse(binaryParser as never);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

    const trainerPdf = await request(app)
      .get(`/api/reports/${reportId}/pdf`)
      .set(auth(trainer.accessToken))
      .buffer(true)
      .parse(binaryParser as never);
    expect(trainerPdf.status).toBe(200);
  });

  it('forbids PDF export before approval for the apprentice', async () => {
    const draft = await createReport(app, azubi, 12, 2026);
    const response = await request(app)
      .get(`/api/reports/${draft.id}/pdf`)
      .set(auth(azubi.accessToken));
    expect(response.status).toBe(403);
  });

  it('rejects reviews from apprentices', async () => {
    const response = await request(app)
      .patch(`/api/reports/${reportId}/review`)
      .set(auth(azubi.accessToken))
      .send({ decision: 'FREIGEGEBEN' });
    expect(response.status).toBe(403);
  });

  it('returns 404 for unknown reports', async () => {
    const response = await request(app)
      .get('/api/reports/00000000-0000-4000-8000-000000000000')
      .set(auth(azubi.accessToken));
    expect(response.status).toBe(404);
  });
});
