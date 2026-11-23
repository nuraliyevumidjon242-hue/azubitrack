import { randomUUID } from 'node:crypto';
import { getDb } from '../index.js';
import type { DbClient } from '../client.js';
import type { RefreshTokenRow } from '../../lib/types.js';

export const refreshTokenRepository = {
  async create(
    input: { userId: string; tokenHash: string; expiresAt: string },
    db: DbClient = getDb(),
  ): Promise<RefreshTokenRow> {
    const row: RefreshTokenRow = {
      id: randomUUID(),
      user_id: input.userId,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
      revoked: 0,
      created_at: new Date().toISOString(),
    };
    await db.execute(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.user_id, row.token_hash, row.expires_at, row.revoked, row.created_at],
    );
    return row;
  },

  async findByHash(tokenHash: string, db: DbClient = getDb()): Promise<RefreshTokenRow | null> {
    return db.queryOne<RefreshTokenRow>('SELECT * FROM refresh_tokens WHERE token_hash = ?', [
      tokenHash,
    ]);
  },

  async revoke(id: string, db: DbClient = getDb()): Promise<void> {
    await db.execute('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?', [id]);
  },

  async revokeAllForUser(userId: string, db: DbClient = getDb()): Promise<void> {
    await db.execute('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [userId]);
  },

  async deleteExpired(nowIso: string, db: DbClient = getDb()): Promise<number> {
    return db.execute('DELETE FROM refresh_tokens WHERE expires_at < ?', [nowIso]);
  },
};
