import pg from 'pg';
import { normalizeParams, toPostgresPlaceholders, type DbClient } from './client.js';

const { Pool } = pg;

/** PostgreSQL client used in production / docker-compose. */
export function createPostgresClient(connectionString: string): DbClient {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on('error', (error) => {
    // Pool errors must never crash the process; log via stderr and keep going.
    process.stderr.write(`Unexpected PostgreSQL pool error: ${error.message}\n`);
  });

  const client: DbClient = {
    dialect: 'postgres',

    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await pool.query(toPostgresPlaceholders(sql), normalizeParams(params));
      return result.rows as T[];
    },

    async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const result = await pool.query(toPostgresPlaceholders(sql), normalizeParams(params));
      return (result.rows[0] as T | undefined) ?? null;
    },

    async execute(sql: string, params: unknown[] = []): Promise<number> {
      const result = await pool.query(toPostgresPlaceholders(sql), normalizeParams(params));
      return result.rowCount ?? 0;
    },

    async exec(sql: string): Promise<void> {
      await pool.query(sql);
    },

    async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
      const connection = await pool.connect();
      const tx: DbClient = {
        ...client,
        query: async <R>(statement: string, params: unknown[] = []) => {
          const result = await connection.query(toPostgresPlaceholders(statement), normalizeParams(params));
          return result.rows as R[];
        },
        queryOne: async <R>(statement: string, params: unknown[] = []) => {
          const result = await connection.query(toPostgresPlaceholders(statement), normalizeParams(params));
          return (result.rows[0] as R | undefined) ?? null;
        },
        execute: async (statement: string, params: unknown[] = []) => {
          const result = await connection.query(toPostgresPlaceholders(statement), normalizeParams(params));
          return result.rowCount ?? 0;
        },
        exec: async (statement: string) => {
          await connection.query(statement);
        },
      };
      try {
        await connection.query('BEGIN');
        const result = await fn(tx);
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      } finally {
        connection.release();
      }
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };

  return client;
}
