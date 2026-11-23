import { createApp } from './app.js';
import { closeDb, initDb } from './db/index.js';
import { runMigrations } from './db/migrations.runner.js';
import { closeCache } from './lib/cache.js';
import { getConfig } from './lib/config.js';
import { logger } from './lib/logger.js';

const config = getConfig();

const db = await initDb();
const applied = await runMigrations(db);
if (applied.length > 0) {
  logger.info({ migrations: applied }, 'Database schema is up to date');
}

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.env,
      database: db.dialect,
      aiProvider: config.ai.provider,
    },
    'AzubiTrack API listening',
  );
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      await closeCache();
      await closeDb();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
