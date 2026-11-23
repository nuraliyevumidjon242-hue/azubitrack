export type Role = 'AZUBI' | 'AUSBILDER';
export type ReportStatus = 'ENTWURF' | 'EINGEREICHT' | 'ABGELEHNT' | 'FREIGEGEBEN';
export type Category = 'BETRIEB' | 'UNTERWEISUNG' | 'BERUFSSCHULE';

export const ROLES: Role[] = ['AZUBI', 'AUSBILDER'];
export const REPORT_STATUSES: ReportStatus[] = [
  'ENTWURF',
  'EINGEREICHT',
  'ABGELEHNT',
  'FREIGEGEBEN',
];
export const CATEGORIES: Category[] = ['BETRIEB', 'UNTERWEISUNG', 'BERUFSSCHULE'];

export const CATEGORY_LABELS: Record<Category, string> = {
  BETRIEB: 'Betriebliche Tätigkeiten',
  UNTERWEISUNG: 'Unterweisungen / betrieblicher Unterricht / sonstige Schulungen',
  BERUFSSCHULE: 'Berufsschule',
};

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  profession: string | null;
  ausbildung_start_date: string | null;
  ausbilder_id: string | null;
  created_at: string;
  is_demo: number;
  demo_session_id: string | null;
  demo_expires_at: string | null;
}

export interface ReportRow {
  id: string;
  azubi_id: string;
  calendar_week: number;
  year: number;
  status: ReportStatus;
  ausbilder_comment: string | null;
  approved_at: string | null;
  approved_by_id: string | null;
  approval_signature: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportEntryRow {
  id: string;
  report_id: string;
  category: Category;
  content: string;
  hours: number;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked: number;
  created_at: string;
}

export interface ReportListRow extends ReportRow {
  azubi_name: string;
  azubi_profession: string | null;
  azubi_start_date: string | null;
  total_hours: number | null;
  entry_count: number | null;
  betrieb_hours: number | null;
  unterweisung_hours: number | null;
  berufsschule_hours: number | null;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  profession: string | null;
  ausbildungStartDate: string | null;
  ausbilderId: string | null;
  isDemo: boolean;
  createdAt: string;
}
