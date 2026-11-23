import { createHash, randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { reportRepository, type EntryInsert } from '../../db/repositories/report.repository.js';
import { userRepository } from '../../db/repositories/user.repository.js';
import { isValidWeek } from '../../lib/dates.js';
import { conflict, forbidden, notFound, unprocessable } from '../../lib/errors.js';
import { getWeekTotals, toEntryDto, toPublicUser, toReportSummary, type EntryDto, type ReportSummaryDto } from '../../lib/mappers.js';
import { canEdit, canReview, canSubmit } from '../../lib/status.js';
import type { Category, ReportListRow, UserRow } from '../../lib/types.js';
import type { EntryInput, ReviewInput } from './report.schemas.js';

export interface ReportDetailDto extends ReportSummaryDto {
  entries: EntryDto[];
  approvalSignature: string | null;
  azubi: {
    id: string;
    fullName: string;
    email: string;
    profession: string | null;
    ausbildungStartDate: string | null;
  };
  ausbilder: { id: string; fullName: string; email: string } | null;
}

interface LoadedReport {
  summary: ReportListRow;
  azubi: UserRow;
  ausbilder: UserRow | null;
}

async function loadReport(reportId: string, user: UserRow): Promise<LoadedReport> {
  const summary = await reportRepository.findSummaryById(reportId);
  if (!summary) throw notFound('Bericht nicht gefunden.');

  const azubi = await userRepository.findById(summary.azubi_id);
  if (!azubi) throw notFound('Azubi nicht gefunden.');

  if (user.role === 'AZUBI') {
    if (summary.azubi_id !== user.id) {
      throw forbidden('Sie dürfen nur Ihre eigenen Berichte einsehen.');
    }
  } else {
    if (azubi.ausbilder_id !== user.id) {
      throw forbidden('Dieser Azubi ist Ihnen nicht zugeordnet.');
    }
  }

  const ausbilder = azubi.ausbilder_id ? await userRepository.findById(azubi.ausbilder_id) : null;
  return { summary, azubi, ausbilder };
}

async function buildDetail(loaded: LoadedReport): Promise<ReportDetailDto> {
  const entries = await reportRepository.findEntries(loaded.summary.id);
  const summary = toReportSummary(loaded.summary);
  return {
    ...summary,
    entries: entries.map(toEntryDto),
    approvalSignature: loaded.summary.approval_signature,
    azubi: {
      id: loaded.azubi.id,
      fullName: loaded.azubi.full_name,
      email: loaded.azubi.email,
      profession: loaded.azubi.profession,
      ausbildungStartDate: loaded.azubi.ausbildung_start_date,
    },
    ausbilder: loaded.ausbilder
      ? {
          id: loaded.ausbilder.id,
          fullName: loaded.ausbilder.full_name,
          email: loaded.ausbilder.email,
        }
      : null,
  };
}

export async function listReports(
  user: UserRow,
  filters: { azubiId?: string; year?: number },
): Promise<ReportSummaryDto[]> {
  let rows: ReportListRow[];
  if (user.role === 'AZUBI') {
    rows = await reportRepository.listForAzubi(user.id);
  } else {
    rows = await reportRepository.listForTrainer(user.id);
    if (filters.azubiId) {
      const azubi = await userRepository.findById(filters.azubiId);
      if (!azubi || azubi.ausbilder_id !== user.id) {
        throw forbidden('Dieser Azubi ist Ihnen nicht zugeordnet.');
      }
      rows = rows.filter((row) => row.azubi_id === filters.azubiId);
    }
  }
  if (filters.year) {
    rows = rows.filter((row) => row.year === filters.year);
  }
  return rows.map(toReportSummary);
}

export async function getReport(reportId: string, user: UserRow): Promise<ReportDetailDto> {
  return buildDetail(await loadReport(reportId, user));
}

export async function createReport(
  user: UserRow,
  input: { calendarWeek: number; year: number },
): Promise<ReportDetailDto> {
  if (user.role !== 'AZUBI') {
    throw forbidden('Nur Azubis können Berichte anlegen.');
  }
  if (!isValidWeek(input.year, input.calendarWeek)) {
    throw unprocessable('Die angegebene Kalenderwoche existiert in diesem Jahr nicht.');
  }

  const existing = await reportRepository.findByWeek(user.id, input.calendarWeek, input.year);
  if (existing) {
    throw conflict(
      `Für KW ${input.calendarWeek}/${input.year} existiert bereits ein Bericht.`,
      { reportId: existing.id },
    );
  }

  const now = new Date().toISOString();
  await reportRepository.insert({
    id: randomUUID(),
    azubiId: user.id,
    calendarWeek: input.calendarWeek,
    year: input.year,
    status: 'ENTWURF',
    createdAt: now,
    updatedAt: now,
  });

  const created = await reportRepository.findByWeek(user.id, input.calendarWeek, input.year);
  if (!created) throw new Error('Report creation failed unexpectedly.');
  return getReport(created.id, user);
}

export async function updateReport(
  reportId: string,
  user: UserRow,
  entries: EntryInput[],
): Promise<ReportDetailDto> {
  if (user.role !== 'AZUBI') {
    throw forbidden('Nur Azubis können Berichtsinhalte bearbeiten.');
  }
  const { summary } = await loadReport(reportId, user);
  if (!canEdit(summary.status)) {
    throw conflict(
      summary.status === 'EINGEREICHT'
        ? 'Der Bericht wurde eingereicht und kann nicht mehr bearbeitet werden.'
        : 'Freigegebene Berichte können nicht mehr bearbeitet werden.',
    );
  }

  const totals = getWeekTotals(entries);
  if (totals.total > 168) {
    throw unprocessable('Die Gesamtstundenzahl eines Berichts darf 168 nicht überschreiten.');
  }

  const now = new Date().toISOString();
  const positions = new Map<Category, number>();
  const rows: EntryInsert[] = entries.map((entry) => {
    const position = positions.get(entry.category) ?? 0;
    positions.set(entry.category, position + 1);
    return {
      id: entry.id ?? randomUUID(),
      reportId,
      category: entry.category,
      content: entry.content.trim(),
      hours: entry.hours,
      position,
      createdAt: now,
      updatedAt: now,
    };
  });

  await getDb().transaction(async (tx) => {
    await reportRepository.deleteEntries(reportId, tx);
    await reportRepository.insertEntries(rows, tx);
    await reportRepository.touch(reportId, now, tx);
  });

  return getReport(reportId, user);
}

export async function submitReport(reportId: string, user: UserRow): Promise<ReportDetailDto> {
  if (user.role !== 'AZUBI') {
    throw forbidden('Nur Azubis können Berichte einreichen.');
  }
  const { summary } = await loadReport(reportId, user);
  if (!canSubmit(summary.status)) {
    throw conflict('Nur Entwürfe oder abgelehnte Berichte können eingereicht werden.');
  }

  const entries = await reportRepository.findEntries(reportId);
  const validEntries = entries.filter((entry) => entry.content.trim().length > 0);
  if (validEntries.length === 0) {
    throw unprocessable('Bitte fügen Sie mindestens einen Eintrag hinzu, bevor Sie einreichen.');
  }
  const totals = getWeekTotals(validEntries);
  if (totals.total <= 0) {
    throw unprocessable('Bitte erfassen Sie die geleisteten Stunden, bevor Sie einreichen.');
  }

  const now = new Date().toISOString();
  await reportRepository.updateStatus(reportId, {
    status: 'EINGEREICHT',
    updatedAt: now,
    submittedAt: now,
    ausbilderComment: summary.ausbilder_comment,
  });
  return getReport(reportId, user);
}

export async function reviewReport(
  reportId: string,
  user: UserRow,
  input: ReviewInput,
): Promise<ReportDetailDto> {
  if (user.role !== 'AUSBILDER') {
    throw forbidden('Nur Ausbilder können Berichte prüfen.');
  }
  const { summary } = await loadReport(reportId, user);
  if (!canReview(summary.status)) {
    throw conflict('Nur eingereichte Berichte können geprüft werden.');
  }

  const entries = await reportRepository.findEntries(reportId);
  const totals = getWeekTotals(entries);
  const now = new Date().toISOString();
  const approved = input.decision === 'FREIGEGEBEN';

  const signature = approved
    ? createHash('sha256')
        .update(
          `${reportId}|${user.id}|${now}|${totals.total.toFixed(2)}|${entries.length}`,
        )
        .digest('hex')
    : null;

  await reportRepository.updateStatus(reportId, {
    status: input.decision,
    updatedAt: now,
    reviewedAt: now,
    ausbilderComment: input.comment ?? null,
    ...(approved
      ? { approvedAt: now, approvedById: user.id, approvalSignature: signature }
      : {}),
  });

  return getReport(reportId, user);
}

export async function getReportForPdf(
  reportId: string,
  user: UserRow,
): Promise<ReportDetailDto> {
  const detail = await getReport(reportId, user);
  if (user.role === 'AZUBI' && detail.status !== 'FREIGEGEBEN') {
    throw forbidden('Der PDF-Export ist erst nach der Freigabe durch den Ausbilder möglich.');
  }
  return detail;
}

export async function getAzubiOverview(trainerId: string) {
  const azubis = await userRepository.listAzubis(trainerId);
  const reports = await reportRepository.listForTrainer(trainerId);
  return azubis.map((azubi) => {
    const publicUser = toPublicUser(azubi);
    return {
      ...publicUser,
      reports: reports
        .filter((report) => report.azubi_id === azubi.id)
        .map((report) => toReportSummary(report)),
    };
  });
}
