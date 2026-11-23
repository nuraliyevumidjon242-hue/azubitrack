import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { reportRepository } from '../../db/repositories/report.repository.js';
import { userRepository } from '../../db/repositories/user.repository.js';
import { getWeekRange } from '../../lib/dates.js';
import { toEntryDto, toPublicUser, toReportSummary } from '../../lib/mappers.js';
import type { UserRow } from '../../lib/types.js';
import { renderReportPdf } from '../pdf/pdf.service.js';
import type { ReportDetailDto } from '../reports/report.service.js';

function buildDetail(
  summary: ReturnType<typeof toReportSummary>,
  entries: Awaited<ReturnType<typeof reportRepository.findEntries>>,
  azubi: UserRow,
  trainer: UserRow | null,
  approvalSignature: string | null,
): ReportDetailDto {
  return {
    ...summary,
    entries: entries.map(toEntryDto),
    approvalSignature,
    azubi: {
      id: azubi.id,
      fullName: azubi.full_name,
      email: azubi.email,
      profession: azubi.profession,
      ausbildungStartDate: azubi.ausbildung_start_date,
    },
    ausbilder: trainer
      ? { id: trainer.id, fullName: trainer.full_name, email: trainer.email }
      : null,
  };
}

/**
 * Builds a DSGVO-compliant data export (JSON + PDF) as a ZIP archive.
 */
export async function buildDataExport(user: UserRow): Promise<Buffer> {
  const profile = toPublicUser(user);
  const reports =
    user.role === 'AZUBI'
      ? await reportRepository.listForAzubi(user.id)
      : await reportRepository.listForTrainer(user.id);

  const trainer = user.ausbilder_id ? await userRepository.findById(user.ausbilder_id) : null;
  const details: ReportDetailDto[] = [];
  const reportJson: Array<Record<string, unknown>> = [];

  for (const row of reports) {
    const entries = await reportRepository.findEntries(row.id);
    const summary = toReportSummary(row);
    const detail = buildDetail(summary, entries, user, trainer, row.approval_signature);
    details.push(detail);
    reportJson.push({
      id: detail.id,
      calendarWeek: detail.calendarWeek,
      year: detail.year,
      dateRange: detail.dateRange,
      trainingYear: detail.trainingYear,
      status: detail.status,
      ausbilderComment: detail.ausbilderComment,
      submittedAt: detail.submittedAt,
      reviewedAt: detail.reviewedAt,
      approvedAt: detail.approvedAt,
      totalHours: detail.totalHours,
      hoursByCategory: detail.hoursByCategory,
      entries: detail.entries,
    });
  }

  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on('data', (chunk: Buffer) => chunks.push(chunk));

  const completed = new Promise<Buffer>((resolve, reject) => {
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(output);

  archive.append(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        application: 'AzubiTrack',
        formatVersion: 1,
        profile,
      },
      null,
      2,
    ),
    { name: 'profil.json' },
  );

  archive.append(JSON.stringify(reportJson, null, 2), { name: 'berichte/berichte.json' });

  archive.append(
    [
      'AzubiTrack – Datenexport',
      '========================',
      '',
      `Erstellt am: ${new Date().toLocaleString('de-DE')}`,
      `Konto: ${profile.email} (${profile.role})`,
      '',
      'Inhalt dieses Archivs:',
      '- profil.json: Ihre Stammdaten',
      '- berichte/berichte.json: alle Berichte inklusive Einträgen (maschinenlesbar)',
      '- berichte/pdf/: alle Berichte als PDF im IHK-Format',
      '',
      'Dieser Export dient der Erfüllung Ihres Rechts auf Datenübertragbarkeit',
      'gemäß Art. 20 DSGVO.',
    ].join('\r\n'),
    { name: 'LIESMICH.txt' },
  );

  for (const detail of details) {
    const range = getWeekRange(detail.year, detail.calendarWeek);
    const pdf = await renderReportPdf(detail);
    archive.append(pdf, {
      name: `berichte/pdf/Ausbildungsnachweis_KW${String(detail.calendarWeek).padStart(2, '0')}_${detail.year}_${range.start}.pdf`,
    });
  }

  await archive.finalize();
  return completed;
}
