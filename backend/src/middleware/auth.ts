import type { NextFunction, Request, Response } from 'express';
import { userRepository } from '../db/repositories/user.repository.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';
import type { Role } from '../lib/types.js';

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw unauthorized('Bitte zuerst anmelden.');
    }
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    const user = await userRepository.findById(payload.sub);
    if (!user) throw unauthorized('Benutzerkonto nicht gefunden.');

    if (user.is_demo === 1 && user.demo_expires_at && new Date(user.demo_expires_at) < new Date()) {
      throw unauthorized('Demo-Sitzung abgelaufen. Bitte neu starten.');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized('Bitte zuerst anmelden.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden('Diese Aktion ist für Ihre Rolle nicht erlaubt.'));
      return;
    }
    next();
  };
}
