import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { getConfig } from './config.js';
import { unauthorized } from './errors.js';
import type { Role } from './types.js';

export const REFRESH_COOKIE = 'azubitrack_refresh';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  type: 'access';
}

export interface IssuedTokens {
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string;
  refreshExpiresAt: string;
}

export function signAccessToken(user: { id: string; role: Role }): {
  token: string;
  expiresIn: number;
} {
  const config = getConfig();
  const expiresIn = config.accessTokenTtlMinutes * 60;
  const token = jwt.sign(
    { sub: user.id, role: user.role, type: 'access' } satisfies AccessTokenPayload,
    config.jwtAccessSecret,
    { expiresIn, issuer: 'azubitrack' },
  );
  return { token, expiresIn };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const config = getConfig();
  try {
    const payload = jwt.verify(token, config.jwtAccessSecret, { issuer: 'azubitrack' });
    if (typeof payload === 'string' || payload.type !== 'access' || !payload.sub) {
      throw unauthorized('Ungültiges Zugriffstoken.');
    }
    return {
      sub: String(payload.sub),
      role: payload.role as Role,
      type: 'access',
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw unauthorized('Sitzung abgelaufen. Bitte erneut anmelden.');
    }
    throw unauthorized('Ungültiges Zugriffstoken.');
  }
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshExpiryDate(): Date {
  const config = getConfig();
  return new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

export function refreshCookieOptions(expires: Date) {
  const config = getConfig();
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.isProduction,
    path: '/api/auth',
    expires,
  };
}

export function setRefreshCookie(res: Response, token: string, expires: Date): void {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(expires));
}

export function clearRefreshCookie(res: Response): void {
  const config = getConfig();
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/api/auth',
  });
}
