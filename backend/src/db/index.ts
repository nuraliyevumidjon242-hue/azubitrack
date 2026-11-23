import { getConfig } from '../lib/config.js';
import type { DbClient } from './client.js';
import { createPostgresClient } from './postgres.js';
import { createSqliteClient } from './sqlite.js';

let instance: DbClient | null = null;

/**
 * Initializes the singleton database client. PostgreSQL is used when
 * DATABASE_URL is configured, otherwise the embedded SQLite database.
 */
export async function initDb(): Promise<DbClient> {
  if (instance) return instance;
  const config = getConfig();
  instance = config.databaseUrl
    ? createPostgresClient(config.databaseUrl)
    : createSqliteClient(config.sqlitePath);
  return instance;
}

export function getDb(): DbClient {
  if (!instance) {
    throw new Error('Database is not initialized. Call initDb() first.');
  }
  return instance;
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}

export type { DbClient };
