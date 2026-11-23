import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { localOptimize, postProcess } from '../src/modules/ai/ai.service.js';
import { buildUserPrompt, SYSTEM_PROMPT } from '../src/modules/ai/ai.prompt.js';
import { auth, registerAzubi, registerTrainer, setupTestApp, type TestContext } from './helpers.js';

let context: TestContext;
let app: Express;

beforeAll(async () => {
  context = await setupTestApp();
  app = context.app;
});

afterAll(async () => {
  await context.close();
});

describe('AI text optimization', () => {
  it('optimizes colloquial notes with the local fallback provider', async () => {
    const azubi = await registerAzubi(app);
    const response = await request(app)
      .post('/api/ai/optimize')
      .set(auth(azubi.accessToken))
      .send({ text: 'heute bug fix gemacht und api getestet', category: 'BETRIEB' });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('local');
    expect(response.body.cached).toBe(false);
    expect(response.body.optimizedText).toBe(
      'Fehlerbehebung durchgeführt und REST-API getestet.',
    );
  });

  it('caches identical optimization requests', async () => {
    const azubi = await registerAzubi(app);
    const payload = { text: 'bugfix im backend gemacht', category: 'BETRIEB' };

    const first = await request(app)
      .post('/api/ai/optimize')
      .set(auth(azubi.accessToken))
      .send(payload);
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);

    const second = await request(app)
      .post('/api/ai/optimize')
      .set(auth(azubi.accessToken))
      .send(payload);
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    expect(second.body.optimizedText).toBe(first.body.optimizedText);
  });

  it('enforces the input length limit', async () => {
    const azubi = await registerAzubi(app);
    const response = await request(app)
      .post('/api/ai/optimize')
      .set(auth(azubi.accessToken))
      .send({ text: 'a'.repeat(1500), category: 'BETRIEB' });
    expect(response.status).toBe(422);
  });

  it('validates the category', async () => {
    const azubi = await registerAzubi(app);
    const response = await request(app)
      .post('/api/ai/optimize')
      .set(auth(azubi.accessToken))
      .send({ text: 'Testtext', category: 'FREIZEIT' });
    expect(response.status).toBe(422);
  });

  it('rejects trainers', async () => {
    const trainer = await registerTrainer(app);
    const response = await request(app)
      .post('/api/ai/optimize')
      .set(auth(trainer.accessToken))
      .send({ text: 'Testtext', category: 'BETRIEB' });
    expect(response.status).toBe(403);
  });
});

describe('AI helpers', () => {
  it('keeps the IHK system prompt rules', () => {
    expect(SYSTEM_PROMPT).toContain('IHK');
    expect(SYSTEM_PROMPT).toContain('NUR den optimierten Text');
    expect(SYSTEM_PROMPT).toContain('maximal 2-3 Sätze');
  });

  it('builds the user prompt from profession, category and raw text', () => {
    const prompt = buildUserPrompt({
      profession: 'Fachinformatiker für Anwendungsentwicklung',
      category: 'BETRIEB',
      text: 'api getestet',
    });
    expect(prompt).toContain('Beruf: Fachinformatiker für Anwendungsentwicklung');
    expect(prompt).toContain('Kategorie: Betriebliche Tätigkeiten');
    expect(prompt).toContain('Rohtext: api getestet');
  });

  it('capitalizes and terminates sentences', () => {
    expect(localOptimize('fehler behoben', 'BETRIEB')).toBe('Fehler behoben.');
  });

  it('prefixes vocational school entries', () => {
    expect(localOptimize('sql wiederholt', 'BERUFSSCHULE')).toBe('Berufsschule: Sql wiederholt.');
  });

  it('strips common AI preambles and quotes', () => {
    expect(postProcess('Hier ist der optimierte Text: „Fehler behoben.“').text).toBe(
      'Fehler behoben.',
    );
  });

  it('truncates overly long responses at a word boundary', () => {
    const long = 'Wort '.repeat(300);
    const result = postProcess(long);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(500);
    expect(result.text.endsWith('…')).toBe(true);
  });
});
