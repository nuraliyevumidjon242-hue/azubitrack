import pino from 'pino';
import { getConfig } from './config.js';

const config = getConfig();

export const logger = pino({
  level: config.env === 'test' ? 'silent' : config.logLevel,
  base: { service: 'azubitrack-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'password_hash',
      'token',
      'refreshToken',
    ],
    censor: '[redacted]',
  },
});
