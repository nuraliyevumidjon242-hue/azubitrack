import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { getConfig } from './config.js';

const tooMany = {
  error: {
    code: 'RATE_LIMITED',
    message: 'Zu viele Anfragen. Bitte in einigen Minuten erneut versuchen.',
  },
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: getConfig().rateLimit.authMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => getConfig().env === 'test',
  message: tooMany,
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: getConfig().rateLimit.aiMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => getConfig().env === 'test',
  keyGenerator: (req: Request) =>
    req.user?.id ?? String(req.ip ?? req.socket.remoteAddress ?? 'unknown'),
  message: tooMany,
});
