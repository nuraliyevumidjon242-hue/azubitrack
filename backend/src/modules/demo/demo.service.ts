import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '../../db/index.js';
import type { DbClient } from '../../db/client.js';
import { reportRepository } from '../../db/repositories/report.repository.js';
import { userRepository } from '../../db/repositories/user.repository.js';
import { getConfig } from '../../lib/config.js';
import { getIsoWeek, getWeekRange } from '../../lib/dates.js';
import { unauthorized } from '../../lib/errors.js';
import { toPublicUser } from '../../lib/mappers.js';
import type { ReportStatus, UserRow } from '../../lib/types.js';
import { demoEmail, issueSessionTokens } from '../auth/auth.service.js';
import { EMMA_WEEKS, LUKAS_WEEKS, type DemoWeekPlan } from './demo.data.js';

const AZUBI_START_OFFSET_YEARS = 2;

function startDateForTrainingYear(trainingYear: number, now: Date): string {
  const year = now.getUTCFullYear() - (trainingYear - 1);
  return `${year}-08-01`;
}

export interface DemoWorkspaceOptions {
  sessionId: string | null;
  trainerEmail: string;
  trainerName?: string;
  azubiEmails: [string, string];
  passwordHash: string;
  isDemo: boolean;
  expiresAt: string | null;
  now?: Date;
}

export interface DemoWorkspace {
  trainer: UserRow;
  azubis: UserRow[];
}

async function insertReportPlan(
  plan: DemoWeekPlan,
  azubiId: string,
  trainerId: string,
  now: Date,
  db: DbClient,
): Promise<void> {
  const reportDate = new Date(now.getTime() - plan.offset * 7 * 24 * 60 * 60 * 1000);
  const { year, week } = getIsoWeek(reportDate);
  const range = getWeekRange(year, week);
  const reportId = randomUUID();
  const createdAt = new Date(`${range.start}T08:00:00Z`).toISOString();
  const submittedAt =
    plan.status === 'ENTWURF'
      ? null
      : new Date(`${range.end}T16:00:00Z`).toISOString();
  const reviewedAt =
    plan.status === 'FREIGEGEBEN' || plan.status === 'ABGELEHNT'
      ? new Date(`${range.end}T18:00:00Z`).toISOString()
      : null;
  const approvedAt =
    plan.status === 'FREIGEGEBEN'
      ? new Date(`${range.end}T18:00:00Z`).toISOString()
      : null;

  const totalHours = plan.entries.reduce((sum, entry) => sum + entry.hours, 0);
  const signature =
    approvedAt && reviewedAt
      ? createHash('sha256')
          .update(`${reportId}|${trainerId}|${approvedAt}|${totalHours.toFixed(2)}|${plan.entries.length}`)
          .digest('hex')
      : null;

  await reportRepository.insert(
    {
      id: reportId,
      azubiId,
      calendarWeek: week,
      year,
      status: plan.status,
      createdAt,
      updatedAt: reviewedAt ?? submittedAt ?? createdAt,
    },
    db,
  );

  await db.execute(
    `UPDATE reports SET
       ausbilder_comment = ?,
       submitted_at = ?,
       reviewed_at = ?,
       approved_at = ?,
       approved_by_id = ?,
       approval_signature = ?
     WHERE id = ?`,
    [
      plan.comment ?? null,
      submittedAt,
      reviewedAt,
      approvedAt,
      approvedAt ? trainerId : null,
      signature,
      reportId,
    ],
  );

  const positions = new Map<string, number>();
  const entries = plan.entries.map((entry) => {
    const position = positions.get(entry.category) ?? 0;
    positions.set(entry.category, position + 1);
    return {
      id: randomUUID(),
      reportId,
      category: entry.category,
      content: entry.content,
      hours: entry.hours,
      position,
      createdAt,
      updatedAt: createdAt,
    };
  });
  await reportRepository.insertEntries(entries, db);
}

/**
 * Creates a fully seeded demo workspace: one trainer, two apprentices and
 * several weeks of reports in different workflow states.
 */
export async function createDemoWorkspace(
  options: DemoWorkspaceOptions,
): Promise<DemoWorkspace> {
  const now = options.now ?? new Date();
  const expiresAt = options.expiresAt;
  const isDemo = options.isDemo;

  return getDb().transaction(async (tx) => {
    const trainer = await userRepository.create(
      {
        email: options.trainerEmail,
        passwordHash: options.passwordHash,
        fullName: options.trainerName ?? 'Sabine Weber',
        role: 'AUSBILDER',
        isDemo,
        demoSessionId: options.sessionId,
        demoExpiresAt: expiresAt,
      },
      tx,
    );

    const lukas = await userRepository.create(
      {
        email: options.azubiEmails[0],
        passwordHash: options.passwordHash,
        fullName: 'Lukas Müller',
        role: 'AZUBI',
        profession: 'Fachinformatiker für Anwendungsentwicklung',
        ausbildungStartDate: startDateForTrainingYear(3, now),
        ausbilderId: trainer.id,
        isDemo,
        demoSessionId: options.sessionId,
        demoExpiresAt: expiresAt,
      },
      tx,
    );

    const emma = await userRepository.create(
      {
        email: options.azubiEmails[1],
        passwordHash: options.passwordHash,
        fullName: 'Emma Schmidt',
        role: 'AZUBI',
        profession: 'Fachinformatikerin für Systemintegration',
        ausbildungStartDate: startDateForTrainingYear(
          Math.max(1, AZUBI_START_OFFSET_YEARS),
          now,
        ),
        ausbilderId: trainer.id,
        isDemo,
        demoSessionId: options.sessionId,
        demoExpiresAt: expiresAt,
      },
      tx,
    );

    for (const plan of LUKAS_WEEKS) {
      await insertReportPlan(plan, lukas.id, trainer.id, now, tx);
    }
    for (const plan of EMMA_WEEKS) {
      await insertReportPlan(plan, emma.id, trainer.id, now, tx);
    }

    return { trainer, azubis: [lukas, emma] };
  });
}

export interface DemoSessionResult {
  user: ReturnType<typeof toPublicUser>;
  tokens: Awaited<ReturnType<typeof issueSessionTokens>>;
  demoSessionId: string;
  demoUsers: Array<{ id: string; fullName: string; role: string }>;
}

function summarize(users: UserRow[]) {
  return users.map((user) => ({
    id: user.id,
    fullName: user.full_name,
    role: user.role,
  }));
}

export async function createOrJoinDemo(
  role: 'AZUBI' | 'AUSBILDER',
  sessionId?: string,
): Promise<DemoSessionResult> {
  const config = getConfig();
  await userRepository.deleteExpiredDemos(new Date().toISOString());

  if (sessionId) {
    const users = await userRepository.listByDemoSession(sessionId);
    if (users.length === 0) {
      throw unauthorized('Die Demo-Sitzung ist abgelaufen. Bitte starten Sie eine neue Demo.');
    }
    const user = users.find((candidate) => candidate.role === role);
    if (!user) {
      throw unauthorized('Diese Demo-Rolle ist in der Sitzung nicht vorhanden.');
    }
    if (user.demo_expires_at && new Date(user.demo_expires_at) < new Date()) {
      await userRepository.deleteDemoSession(sessionId);
      throw unauthorized('Die Demo-Sitzung ist abgelaufen. Bitte starten Sie eine neue Demo.');
    }
    return {
      user: toPublicUser(user),
      tokens: await issueSessionTokens(user),
      demoSessionId: sessionId,
      demoUsers: summarize(users),
    };
  }

  const newSessionId = randomUUID();
  const expiresAt = new Date(
    Date.now() + config.demo.ttlMinutes * 60 * 1000,
  ).toISOString();
  // Demo accounts are not meant to be logged into with a password.
  const passwordHash = await bcrypt.hash(randomUUID(), 10);

  const workspace = await createDemoWorkspace({
    sessionId: newSessionId,
    trainerEmail: demoEmail(newSessionId, 'AUSBILDER'),
    azubiEmails: [demoEmail(newSessionId, 'AZUBI'), demoEmail(newSessionId, 'AZUBI', 2)],
    passwordHash,
    isDemo: true,
    expiresAt,
  });

  const user = role === 'AUSBILDER' ? workspace.trainer : workspace.azubis[0]!;
  return {
    user: toPublicUser(user),
    tokens: await issueSessionTokens(user),
    demoSessionId: newSessionId,
    demoUsers: summarize([workspace.trainer, ...workspace.azubis]),
  };
}
