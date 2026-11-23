import { randomUUID } from 'node:crypto';
import { getDb } from '../index.js';
import type { DbClient } from '../client.js';
import type { Role, UserRow } from '../../lib/types.js';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  profession?: string | null;
  ausbildungStartDate?: string | null;
  ausbilderId?: string | null;
  isDemo?: boolean;
  demoSessionId?: string | null;
  demoExpiresAt?: string | null;
}

export const userRepository = {
  async findById(id: string, db: DbClient = getDb()): Promise<UserRow | null> {
    return db.queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  },

  async findByEmail(email: string, db: DbClient = getDb()): Promise<UserRow | null> {
    return db.queryOne<UserRow>('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  },

  async create(input: CreateUserInput, db: DbClient = getDb()): Promise<UserRow> {
    const user: UserRow = {
      id: randomUUID(),
      email: input.email.trim().toLowerCase(),
      password_hash: input.passwordHash,
      full_name: input.fullName.trim(),
      role: input.role,
      profession: input.profession ?? null,
      ausbildung_start_date: input.ausbildungStartDate ?? null,
      ausbilder_id: input.ausbilderId ?? null,
      created_at: new Date().toISOString(),
      is_demo: input.isDemo ? 1 : 0,
      demo_session_id: input.demoSessionId ?? null,
      demo_expires_at: input.demoExpiresAt ?? null,
    };

    await db.execute(
      `INSERT INTO users
        (id, email, password_hash, full_name, role, profession, ausbildung_start_date,
         ausbilder_id, created_at, is_demo, demo_session_id, demo_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.email,
        user.password_hash,
        user.full_name,
        user.role,
        user.profession,
        user.ausbildung_start_date,
        user.ausbilder_id,
        user.created_at,
        user.is_demo,
        user.demo_session_id,
        user.demo_expires_at,
      ],
    );
    return user;
  },

  async linkTrainer(azubiId: string, trainerId: string, db: DbClient = getDb()): Promise<void> {
    await db.execute('UPDATE users SET ausbilder_id = ? WHERE id = ? AND role = ?', [
      trainerId,
      azubiId,
      'AZUBI',
    ]);
  },

  async listAzubis(trainerId: string, db: DbClient = getDb()): Promise<UserRow[]> {
    return db.query<UserRow>(
      'SELECT * FROM users WHERE ausbilder_id = ? AND role = ? ORDER BY full_name ASC',
      [trainerId, 'AZUBI'],
    );
  },

  async listByDemoSession(sessionId: string, db: DbClient = getDb()): Promise<UserRow[]> {
    return db.query<UserRow>('SELECT * FROM users WHERE demo_session_id = ? ORDER BY role ASC', [
      sessionId,
    ]);
  },

  async deleteById(id: string, db: DbClient = getDb()): Promise<void> {
    await db.execute('DELETE FROM users WHERE id = ?', [id]);
  },

  async deleteDemoSession(sessionId: string, db: DbClient = getDb()): Promise<void> {
    await db.execute('DELETE FROM users WHERE demo_session_id = ?', [sessionId]);
  },

  async deleteExpiredDemos(nowIso: string, db: DbClient = getDb()): Promise<number> {
    return db.execute(
      'DELETE FROM users WHERE is_demo = 1 AND demo_expires_at IS NOT NULL AND demo_expires_at < ?',
      [nowIso],
    );
  },
};
