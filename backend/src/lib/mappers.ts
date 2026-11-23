import { getTrainingYear, getWeekRange } from './dates.js';
import type {
  AuthUser,
  Category,
  ReportEntryRow,
  ReportListRow,
  UserRow,
} from './types.js';

export interface EntryDto {
  id: string;
  category: Category;
  content: string;
  hours: number;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSummaryDto {
  id: string;
  azubiId: string;
  azubiName: string;
  profession: string | null;
  calendarWeek: number;
  year: number;
  status: ReportListRow['status'];
  ausbilderComment: string | null;
  approvedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalHours: number;
  entryCount: number;
  hoursByCategory: Record<Category, number>;
  dateRange: { start: string; end: string; days: string[] };
  trainingYear: number | null;
  editable: boolean;
  canSubmit: boolean;
  canReview: boolean;
}

export function toPublicUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    profession: row.profession,
    ausbildungStartDate: row.ausbildung_start_date,
    ausbilderId: row.ausbilder_id,
    isDemo: row.is_demo === 1,
    createdAt: row.created_at,
  };
}

export function toEntryDto(row: ReportEntryRow): EntryDto {
  return {
    id: row.id,
    category: row.category,
    content: row.content,
    hours: Number(row.hours),
    position: Number(row.position),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toReportSummary(row: ReportListRow): ReportSummaryDto {
  const range = getWeekRange(row.year, row.calendar_week);
  const monday = new Date(`${range.start}T00:00:00Z`);
  return {
    id: row.id,
    azubiId: row.azubi_id,
    azubiName: row.azubi_name,
    profession: row.azubi_profession,
    calendarWeek: row.calendar_week,
    year: row.year,
    status: row.status,
    ausbilderComment: row.ausbilder_comment,
    approvedAt: row.approved_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    totalHours: roundHours(Number(row.total_hours ?? 0)),
    entryCount: Number(row.entry_count ?? 0),
    hoursByCategory: {
      BETRIEB: roundHours(Number(row.betrieb_hours ?? 0)),
      UNTERWEISUNG: roundHours(Number(row.unterweisung_hours ?? 0)),
      BERUFSSCHULE: roundHours(Number(row.berufsschule_hours ?? 0)),
    },
    dateRange: range,
    trainingYear: getTrainingYear(row.azubi_start_date, monday),
    editable: row.status === 'ENTWURF' || row.status === 'ABGELEHNT',
    canSubmit: row.status === 'ENTWURF' || row.status === 'ABGELEHNT',
    canReview: row.status === 'EINGEREICHT',
  };
}

export function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getWeekTotals(entries: Array<{ category: Category; hours: number }>): {
  total: number;
  byCategory: Record<Category, number>;
} {
  const byCategory: Record<Category, number> = {
    BETRIEB: 0,
    UNTERWEISUNG: 0,
    BERUFSSCHULE: 0,
  };
  let total = 0;
  for (const entry of entries) {
    byCategory[entry.category] += entry.hours;
    total += entry.hours;
  }
  return {
    total: roundHours(total),
    byCategory: {
      BETRIEB: roundHours(byCategory.BETRIEB),
      UNTERWEISUNG: roundHours(byCategory.UNTERWEISUNG),
      BERUFSSCHULE: roundHours(byCategory.BERUFSSCHULE),
    },
  };
}
