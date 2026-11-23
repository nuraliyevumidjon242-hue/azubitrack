export type DbDialect = 'sqlite' | 'postgres';

export interface DbClient {
  readonly dialect: DbDialect;
  /** Runs a SELECT and returns all rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs a SELECT and returns the first row or null. */
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  /** Runs a statement and returns the number of affected rows. */
  execute(sql: string, params?: unknown[]): Promise<number>;
  /** Runs one or more statements without parameters (DDL / migrations). */
  exec(sql: string): Promise<void>;
  /** Runs the callback inside a transaction. */
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function normalizeParams(params: unknown[] = []): unknown[] {
  return params.map((param) => {
    if (param === undefined) return null;
    if (typeof param === 'boolean') return param ? 1 : 0;
    if (param instanceof Date) return param.toISOString();
    return param;
  });
}

/** Converts `?` placeholders into PostgreSQL `$1..$n` placeholders. */
export function toPostgresPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}
