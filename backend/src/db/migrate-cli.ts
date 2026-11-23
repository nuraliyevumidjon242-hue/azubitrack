import { closeDb, initDb } from './index.js';
import { runMigrations } from './migrations.runner.js';
import { logger } from '../lib/logger.js';

async function main(): Promise<void> {
  const db = await initDb();
  const applied = await runMigrations(db);
  if (applied.length === 0) {
    logger.info('Database is already up to date');
  } else {
    logger.info({ applied }, 'Migrations applied');
  }
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error({ err: error }, 'Migration failed');
    await closeDb().catch(() => undefined);
    process.exit(1);
  });
