import { getDb } from '../index.js';
import type { DbClient } from '../client.js';
import type { Category, ReportEntryRow, ReportListRow, ReportRow, ReportStatus } from '../../lib/types.js';

const SUMMARY_SELECT = `
  SELECT r.*,
    u.full_name AS azubi_name,
    u.profession AS azubi_profession,
    u.ausbildung_start_date AS azubi_start_date,
    COALESCE(SUM(e.hours), 0) AS total_hours,
    COUNT(e.id) AS entry_count,
    COALESCE(SUM(CASE WHEN e.category = 'BETRIEB' THEN e.hours ELSE 0 END), 0) AS betrieb_hours,
    COALESCE(SUM(CASE WHEN e.category = 'UNTERWEISUNG' THEN e.hours ELSE 0 END), 0) AS unterweisung_hours,
    COALESCE(SUM(CASE WHEN e.category = 'BERUFSSCHULE' THEN e.hours ELSE 0 END), 0) AS berufsschule_hours
  FROM reports r
  JOIN users u ON u.id = r.azubi_id
  LEFT JOIN report_entries e ON e.report_id = r.id
`;

const SUMMARY_GROUP = `
  GROUP BY r.id, u.full_name, u.profession, u.ausbildung_start_date
`;

export interface ReportInsert {
  id: string;
  azubiId: string;
  calendarWeek: number;
  year: number;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EntryInsert {
  id: string;
  reportId: string;
  category: Category;
  content: string;
  hours: number;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export const reportRepository = {
  async findSummaryById(id: string, db: DbClient = getDb()): Promise<ReportListRow | null> {
    return db.queryOne<ReportListRow>(
      `${SUMMARY_SELECT} WHERE r.id = ? ${SUMMARY_GROUP}`,
      [id],
    );
  },

  async listForAzubi(azubiId: string, db: DbClient = getDb()): Promise<ReportListRow[]> {
    return db.query<ReportListRow>(
      `${SUMMARY_SELECT} WHERE r.azubi_id = ? ${SUMMARY_GROUP} ORDER BY r.year DESC, r.calendar_week DESC`,
      [azubiId],
    );
  },

  async listForTrainer(trainerId: string, db: DbClient = getDb()): Promise<ReportListRow[]> {
    return db.query<ReportListRow>(
      `${SUMMARY_SELECT} WHERE u.ausbilder_id = ? ${SUMMARY_GROUP} ORDER BY r.year DESC, r.calendar_week DESC`,
      [trainerId],
    );
  },

  async findById(id: string, db: DbClient = getDb()): Promise<ReportRow | null> {
    return db.queryOne<ReportRow>('SELECT * FROM reports WHERE id = ?', [id]);
  },

  async findByWeek(
    azubiId: string,
    calendarWeek: number,
    year: number,
    db: DbClient = getDb(),
  ): Promise<ReportRow | null> {
    return db.queryOne<ReportRow>(
      'SELECT * FROM reports WHERE azubi_id = ? AND calendar_week = ? AND year = ?',
      [azubiId, calendarWeek, year],
    );
  },

  async insert(report: ReportInsert, db: DbClient = getDb()): Promise<void> {
    await db.execute(
      `INSERT INTO reports
        (id, azubi_id, calendar_week, year, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        report.id,
        report.azubiId,
        report.calendarWeek,
        report.year,
        report.status,
        report.createdAt,
        report.updatedAt,
      ],
    );
  },

  async updateStatus(
    id: string,
    patch: {
      status: ReportStatus;
      updatedAt: string;
      ausbilderComment?: string | null;
      submittedAt?: string | null;
      reviewedAt?: string | null;
      approvedAt?: string | null;
      approvedById?: string | null;
      approvalSignature?: string | null;
    },
    db: DbClient = getDb(),
  ): Promise<void> {
    await db.execute(
      `UPDATE reports SET
         status = ?,
         updated_at = ?,
         ausbilder_comment = ?,
         submitted_at = COALESCE(?, submitted_at),
         reviewed_at = COALESCE(?, reviewed_at),
         approved_at = COALESCE(?, approved_at),
         approved_by_id = COALESCE(?, approved_by_id),
         approval_signature = COALESCE(?, approval_signature)
       WHERE id = ?`,
      [
        patch.status,
        patch.updatedAt,
        patch.ausbilderComment ?? null,
        patch.submittedAt ?? null,
        patch.reviewedAt ?? null,
        patch.approvedAt ?? null,
        patch.approvedById ?? null,
        patch.approvalSignature ?? null,
        id,
      ],
    );
  },

  async touch(id: string, updatedAt: string, db: DbClient = getDb()): Promise<void> {
    await db.execute('UPDATE reports SET updated_at = ? WHERE id = ?', [updatedAt, id]);
  },

  async deleteEntries(reportId: string, db: DbClient = getDb()): Promise<void> {
    await db.execute('DELETE FROM report_entries WHERE report_id = ?', [reportId]);
  },

  async insertEntries(entries: EntryInsert[], db: DbClient = getDb()): Promise<void> {
    for (const entry of entries) {
      await db.execute(
        `INSERT INTO report_entries
          (id, report_id, category, content, hours, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id,
          entry.reportId,
          entry.category,
          entry.content,
          entry.hours,
          entry.position,
          entry.createdAt,
          entry.updatedAt,
        ],
      );
    }
  },

  async findEntries(reportId: string, db: DbClient = getDb()): Promise<ReportEntryRow[]> {
    return db.query<ReportEntryRow>(
      `SELECT * FROM report_entries WHERE report_id = ?
       ORDER BY CASE category
         WHEN 'BETRIEB' THEN 1
         WHEN 'UNTERWEISUNG' THEN 2
         WHEN 'BERUFSSCHULE' THEN 3
         ELSE 4 END, position ASC, created_at ASC`,
      [reportId],
    );
  },
};
