-- AzubiTrack initial schema
-- Portable SQL: works with SQLite (node:sqlite) and PostgreSQL.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('AZUBI', 'AUSBILDER')),
  profession TEXT,
  ausbildung_start_date TEXT,
  ausbilder_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  demo_session_id TEXT,
  demo_expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_ausbilder ON users (ausbilder_id);
CREATE INDEX IF NOT EXISTS idx_users_demo_session ON users (demo_session_id);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  azubi_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calendar_week INTEGER NOT NULL CHECK (calendar_week BETWEEN 1 AND 53),
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ENTWURF'
    CHECK (status IN ('ENTWURF', 'EINGEREICHT', 'ABGELEHNT', 'FREIGEGEBEN')),
  ausbilder_comment TEXT,
  approved_at TEXT,
  approved_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  approval_signature TEXT,
  submitted_at TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (azubi_id, calendar_week, year)
);

CREATE INDEX IF NOT EXISTS idx_reports_azubi ON reports (azubi_id, year, calendar_week);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);

CREATE TABLE IF NOT EXISTS report_entries (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('BETRIEB', 'UNTERWEISUNG', 'BERUFSSCHULE')),
  content TEXT NOT NULL,
  hours REAL NOT NULL CHECK (hours >= 0 AND hours <= 168),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_entries_report ON report_entries (report_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE IF NOT EXISTS ai_cache (
  cache_key TEXT PRIMARY KEY,
  optimized_text TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL
);
