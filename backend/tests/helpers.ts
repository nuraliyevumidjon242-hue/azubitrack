import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { Express } from 'express';

export interface TestContext {
  app: Express;
  close: () => Promise<void>;
}

export async function setupTestApp(): Promise<TestContext> {
  const dbPath = join(tmpdir(), `azubitrack-test-${randomUUID()}.db`);

  process.env.NODE_ENV = 'test';
  process.env.SQLITE_PATH = dbPath;
  process.env.DATABASE_URL = '';
  process.env.REDIS_URL = '';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdefghijkl';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdefghijkl';
  process.env.AI_PROVIDER = 'local';
  process.env.OPENAI_API_KEY = '';
  process.env.GEMINI_API_KEY = '';

  const { resetConfig } = await import('../src/lib/config.js');
  resetConfig();
  const { initDb, closeDb } = await import('../src/db/index.js');
  const { runMigrations } = await import('../src/db/migrations.runner.js');
  const db = await initDb();
  await runMigrations(db);
  const { createApp } = await import('../src/app.js');
  const app = createApp();

  return {
    app,
    close: async () => {
      await closeDb();
      for (const suffix of ['', '-wal', '-shm', '-journal']) {
        const file = `${dbPath}${suffix}`;
        if (existsSync(file)) {
          try {
            unlinkSync(file);
          } catch {
            // ignore
          }
        }
      }
    },
  };
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${randomUUID()}@example.test`;
}

export function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export interface RegisteredUser {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: 'AZUBI' | 'AUSBILDER';
    profession: string | null;
    isDemo: boolean;
  };
  accessToken: string;
  email: string;
  password: string;
}

const PASSWORD = 'Passwort123';

export async function registerAzubi(
  app: Express,
  overrides: Record<string, unknown> = {},
): Promise<RegisteredUser> {
  const email = (overrides.email as string | undefined) ?? uniqueEmail('azubi');
  const payload = {
    email,
    password: PASSWORD,
    fullName: 'Lena Beispiel',
    role: 'AZUBI',
    profession: 'Fachinformatikerin für Anwendungsentwicklung',
    ausbildungStartDate: '2024-08-01',
    ...overrides,
  };
  const response = await request(app).post('/api/auth/register').send(payload);
  if (response.status !== 201) {
    throw new Error(`Azubi registration failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return {
    user: response.body.user,
    accessToken: response.body.accessToken,
    email,
    password: PASSWORD,
  };
}

export async function registerTrainer(
  app: Express,
  overrides: Record<string, unknown> = {},
): Promise<RegisteredUser> {
  const email = (overrides.email as string | undefined) ?? uniqueEmail('trainer');
  const payload = {
    email,
    password: PASSWORD,
    fullName: 'Thomas Ausbilder',
    role: 'AUSBILDER',
    ...overrides,
  };
  const response = await request(app).post('/api/auth/register').send(payload);
  if (response.status !== 201) {
    throw new Error(
      `Trainer registration failed (${response.status}): ${JSON.stringify(response.body)}`,
    );
  }
  return {
    user: response.body.user,
    accessToken: response.body.accessToken,
    email,
    password: PASSWORD,
  };
}

export async function linkAzubi(
  app: Express,
  trainer: RegisteredUser,
  azubiEmail: string,
): Promise<void> {
  const response = await request(app)
    .post('/api/users/link-azubi')
    .set(auth(trainer.accessToken))
    .send({ email: azubiEmail });
  if (response.status !== 201) {
    throw new Error(`Linking failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
}

export async function createReport(
  app: Express,
  azubi: RegisteredUser,
  calendarWeek: number,
  year: number,
): Promise<{ id: string; status: string }> {
  const response = await request(app)
    .post('/api/reports')
    .set(auth(azubi.accessToken))
    .send({ calendarWeek, year });
  if (response.status !== 201) {
    throw new Error(`Report creation failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return response.body.report;
}

export function binaryParser(
  res: NodeJS.ReadableStream,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}
