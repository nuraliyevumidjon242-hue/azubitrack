import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { normalizeParams, type DbClient } from './client.js';

/**
 * Local development database backed by Node's built-in SQLite module.
 * No native compilation required.
 */
export function createSqliteClient(path: string): DbClient {
  const isMemory = path === ':memory:' || path === '';
  const file = isMemory ? ':memory:' : resolve(process.cwd(), path);
  if (!isMemory) {
    mkdirSync(dirname(file), { recursive: true });
  }

  const database = new DatabaseSync(file);
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA busy_timeout = 5000;');
  if (!isMemory) {
    database.exec('PRAGMA journal_mode = WAL;');
  }

  const client: DbClient = {
    dialect: 'sqlite',

    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const statement = database.prepare(sql);
      return statement.all(...(normalizeParams(params) as never[])) as T[];
    },

    async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const statement = database.prepare(sql);
      const row = statement.get(...(normalizeParams(params) as never[]));
      return (row as T | undefined) ?? null;
    },

    async execute(sql: string, params: unknown[] = []): Promise<number> {
      const statement = database.prepare(sql);
      const result = statement.run(...(normalizeParams(params) as never[]));
      return Number(result.changes ?? 0);
    },

    async exec(sql: string): Promise<void> {
      database.exec(sql);
    },

    async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
      database.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn(client);
        database.exec('COMMIT');
        return result;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },

    async close(): Promise<void> {
      database.close();
    },
  };

  return client;
}
