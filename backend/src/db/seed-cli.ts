import bcrypt from 'bcryptjs';
import { closeDb, initDb } from './index.js';
import { runMigrations } from './migrations.runner.js';
import { userRepository } from './repositories/user.repository.js';
import { logger } from '../lib/logger.js';
import { createDemoWorkspace } from '../modules/demo/demo.service.js';

const SEED_PASSWORD = 'AzubiTrack2026!';
const TRAINER_EMAIL = 'ausbilder@azubitrack.local';
const AZUBI_EMAIL = 'azubi@azubitrack.local';
const AZUBI2_EMAIL = 'emma@azubitrack.local';

async function main(): Promise<void> {
  const db = await initDb();
  await runMigrations(db);

  // Idempotency: remove previously seeded accounts (cascade removes reports).
  for (const email of [TRAINER_EMAIL, AZUBI_EMAIL, AZUBI2_EMAIL]) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      await userRepository.deleteById(existing.id);
      logger.info({ email }, 'Removed previous seed account');
    }
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  await createDemoWorkspace({
    sessionId: null,
    trainerEmail: TRAINER_EMAIL,
    trainerName: 'Sabine Weber',
    azubiEmails: [AZUBI_EMAIL, AZUBI2_EMAIL],
    passwordHash,
    isDemo: false,
    expiresAt: null,
  });

  process.stdout.write(
    [
      '',
      'Seed data created successfully.',
      '',
      `  Ausbilder: ${TRAINER_EMAIL} / ${SEED_PASSWORD}`,
      `  Azubi:     ${AZUBI_EMAIL} / ${SEED_PASSWORD}`,
      `  Azubi 2:   ${AZUBI2_EMAIL} / ${SEED_PASSWORD}`,
      '',
    ].join('\n'),
  );
}

main()
  .then(async () => {
    await closeDb();
  })
  .catch(async (error) => {
    logger.error({ err: error }, 'Seeding failed');
    await closeDb().catch(() => undefined);
    process.exit(1);
  });
