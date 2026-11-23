import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { refreshTokenRepository } from '../../db/repositories/refreshToken.repository.js';
import { userRepository } from '../../db/repositories/user.repository.js';
import { conflict, unauthorized, unprocessable } from '../../lib/errors.js';
import { toPublicUser } from '../../lib/mappers.js';
import {
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
  signAccessToken,
  type IssuedTokens,
} from '../../lib/tokens.js';
import type { AuthUser, UserRow } from '../../lib/types.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  user: AuthUser;
  tokens: IssuedTokens;
}

export async function issueSessionTokens(user: UserRow): Promise<IssuedTokens> {
  const access = signAccessToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = refreshExpiryDate();

  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiresAt.toISOString(),
  });

  return {
    accessToken: access.token,
    accessExpiresIn: access.expiresIn,
    refreshToken,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
  };
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw conflict('Für diese E-Mail-Adresse existiert bereits ein Konto.');
  }

  let ausbilderId: string | null = null;
  if (input.role === 'AZUBI' && input.ausbilderEmail) {
    const trainer = await userRepository.findByEmail(input.ausbilderEmail);
    if (!trainer || trainer.role !== 'AUSBILDER') {
      throw unprocessable('Es wurde kein Ausbilder mit dieser E-Mail-Adresse gefunden.', [
        { path: 'ausbilderEmail', message: 'Ausbilder nicht gefunden.' },
      ]);
    }
    ausbilderId = trainer.id;
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await userRepository.create({
    email,
    passwordHash,
    fullName: input.fullName,
    role: input.role,
    profession: input.role === 'AZUBI' ? (input.profession ?? null) : null,
    ausbildungStartDate: input.role === 'AZUBI' ? (input.ausbildungStartDate ?? null) : null,
    ausbilderId,
  });

  return { user: toPublicUser(user), tokens: await issueSessionTokens(user) };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await userRepository.findByEmail(input.email);
  if (!user || user.is_demo === 1) {
    // Constant-ish response time to avoid user enumeration.
    await bcrypt.compare(input.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    throw unauthorized('E-Mail-Adresse oder Passwort ist falsch.');
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordMatches) {
    throw unauthorized('E-Mail-Adresse oder Passwort ist falsch.');
  }

  // Housekeeping: drop expired refresh tokens.
  await refreshTokenRepository.deleteExpired(new Date().toISOString());

  return { user: toPublicUser(user), tokens: await issueSessionTokens(user) };
}

/**
 * Rotates a refresh token: the presented token is revoked and a new one is
 * issued. Reuse of an already revoked token revokes the whole token family.
 */
export async function refreshSession(rawToken: string | undefined): Promise<AuthResult> {
  if (!rawToken) {
    throw unauthorized('Kein Refresh-Token vorhanden.');
  }

  const tokenHash = hashToken(rawToken);
  const stored = await refreshTokenRepository.findByHash(tokenHash);
  if (!stored) {
    throw unauthorized('Ungültige Sitzung. Bitte erneut anmelden.');
  }

  if (stored.revoked === 1) {
    // Possible token theft — invalidate all sessions of that user.
    await refreshTokenRepository.revokeAllForUser(stored.user_id);
    throw unauthorized('Sitzung wurde beendet. Bitte erneut anmelden.');
  }

  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await refreshTokenRepository.revoke(stored.id);
    throw unauthorized('Sitzung abgelaufen. Bitte erneut anmelden.');
  }

  const user = await userRepository.findById(stored.user_id);
  if (!user) {
    throw unauthorized('Benutzerkonto nicht gefunden.');
  }

  if (user.is_demo === 1 && user.demo_expires_at && new Date(user.demo_expires_at) < new Date()) {
    await userRepository.deleteDemoSession(user.demo_session_id ?? '', getDb());
    throw unauthorized('Demo-Sitzung abgelaufen. Bitte neu starten.');
  }

  await refreshTokenRepository.revoke(stored.id);
  return { user: toPublicUser(user), tokens: await issueSessionTokens(user) };
}

export async function logoutSession(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const stored = await refreshTokenRepository.findByHash(hashToken(rawToken));
  if (!stored) return;

  await refreshTokenRepository.revoke(stored.id);

  const user = await userRepository.findById(stored.user_id);
  if (user?.is_demo === 1 && user.demo_session_id) {
    // Demo data is ephemeral: wipe the whole workspace on logout.
    await userRepository.deleteDemoSession(user.demo_session_id);
  }
}

export async function deleteOwnAccount(userId: string): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user) throw unauthorized('Benutzerkonto nicht gefunden.');

  await refreshTokenRepository.revokeAllForUser(userId);
  await userRepository.deleteById(userId);
}

export async function getUser(userId: string): Promise<AuthUser> {
  const user = await userRepository.findById(userId);
  if (!user) throw unauthorized('Benutzerkonto nicht gefunden.');
  return toPublicUser(user);
}

/** Used by the Ausbilder UI to connect an existing apprentice by e-mail. */
export async function linkAzubi(trainerId: string, email: string): Promise<AuthUser> {
  const azubi = await userRepository.findByEmail(email);
  if (!azubi || azubi.role !== 'AZUBI') {
    throw unprocessable('Es wurde kein Azubi mit dieser E-Mail-Adresse gefunden.', [
      { path: 'email', message: 'Azubi nicht gefunden.' },
    ]);
  }
  if (azubi.ausbilder_id && azubi.ausbilder_id !== trainerId) {
    throw conflict('Dieser Azubi ist bereits einem anderen Ausbilder zugeordnet.');
  }
  await userRepository.linkTrainer(azubi.id, trainerId);
  const updated = await userRepository.findById(azubi.id);
  return toPublicUser(updated ?? azubi);
}

export async function createPasswordHash(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function demoEmail(sessionId: string, role: 'AZUBI' | 'AUSBILDER', index = 0): string {
  return `demo-${sessionId.slice(0, 8)}-${role.toLowerCase()}${index || ''}@azubitrack.local`;
}

export function newSessionId(): string {
  return randomUUID();
}
