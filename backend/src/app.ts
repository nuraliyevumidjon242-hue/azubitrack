import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { getDb } from './db/index.js';
import { getConfig } from './lib/config.js';
import { asyncHandler } from './lib/http.js';
import { logger } from './lib/logger.js';
import { aiLimiter, authLimiter } from './lib/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { aiRouter } from './modules/ai/ai.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { exportRouter } from './modules/export/export.routes.js';
import { reportRouter } from './modules/reports/report.routes.js';
import { userRouter } from './modules/users/user.routes.js';

export function createApp(): express.Express {
  const config = getConfig();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: config.env !== 'test',
      quietReqLogger: true,
    }),
  );

  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      const db = getDb();
      await db.queryOne('SELECT 1 AS ok');
      res.json({
        status: 'ok',
        service: 'azubitrack-api',
        database: db.dialect,
        timestamp: new Date().toISOString(),
      });
    }),
  );

  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/reports', reportRouter);
  app.use('/api/users', userRouter);
  app.use('/api/ai', aiLimiter, aiRouter);
  app.use('/api/export', exportRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
