import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type { DbClient } from './client.js';

function resolveMigrationsDir(): string {
  const config = getConfig();
  const candidates = [
    config.migrationsDir,
    resolve(process.cwd(), 'db/migrations'),
    resolve(process.cwd(), '../db/migrations'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Migrations directory not found. Looked in: ${candidates.join(', ')}`,
  );
}

/** Applies all pending `.sql` migrations in lexicographic order. */
export async function runMigrations(client: DbClient): Promise<string[]> {
  await client.execute(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  );

  const directory = resolveMigrationsDir();
  const files = readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const appliedRows = await client.query<{ name: string }>('SELECT name FROM _migrations');
  const applied = new Set(appliedRows.map((row) => row.name));
  const freshlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(resolve(directory, file), 'utf8');
    logger.info({ migration: file }, 'Applying database migration');
    await client.exec(sql);
    await client.execute('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', [
      file,
      new Date().toISOString(),
    ]);
    freshlyApplied.push(file);
  }

  return freshlyApplied;
}
