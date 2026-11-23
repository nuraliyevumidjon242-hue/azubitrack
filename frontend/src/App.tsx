import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, BarChart3, BookOpen, Check, Clock3,
  Download, LogOut, Plus, Sparkles, Trash2,
} from 'lucide-react';

type Role = 'AZUBI' | 'AUSBILDER';
type Status = 'ENTWURF' | 'EINGEREICHT' | 'ABGELEHNT' | 'FREIGEGEBEN';
type Category = 'BETRIEB' | 'UNTERWEISUNG' | 'BERUFSSCHULE';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  profession?: string | null;
  isDemo?: boolean;
}
interface Entry { id?: string; category: Category; content: string; hours: number }
interface Report {
  id: string;
  calendarWeek: number;
  year: number;
  status: Status;
  entries: Entry[];
  ausbilderComment: string | null;
  azubi: { fullName: string; profession: string | null };
  approvedAt: string | null;
  weekStart: string;
  weekEnd: string;
  trainingYear: number | null;
}

const tokenKey = 'azubitrack_access_token';
let accessToken = localStorage.getItem(tokenKey);

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Ein Fehler ist aufgetreten.' }));
    throw new Error(body.error ?? body.message ?? 'Ein Fehler ist aufgetreten.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function setSession(token: string, user: User) {
  accessToken = token;
  localStorage.setItem(tokenKey, token);
  localStorage.setItem('azubitrack_user', JSON.stringify(user));
}

function getUser(): User | null {
  try { return JSON.parse(localStorage.getItem('azubitrack_user') ?? 'null'); }
  catch { return null; }
}

function clearSession() {
  accessToken = null;
  localStorage.removeItem(tokenKey);
  localStorage.removeItem('azubitrack_user');
}

function StatusBadge({ status }: { status: Status }) {
  const labels: Record<Status, string> = {
    ENTWURF: 'Entwurf', EINGEREICHT: 'In Prüfung', ABGELEHNT: 'Abgelehnt', FREIGEGEBEN: 'Freigegeben',
  };
  return <span className={`badge status-${status.toLowerCase()}`}>{labels[status]}</span>;
}

function Shell({ user, children }: { user: User; children: ReactNode }) {
  const navigate = useNavigate();
  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* Session is local. */ }
    clearSession();
    navigate('/');
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/dashboard"><span className="brand-mark">A</span><span>AzubiTrack</span></Link>
        {user.isDemo && <div className="demo-pill">Demo-Modus</div>}
        <nav>
          <Link to="/dashboard" className="nav-item active"><BarChart3 size={18} /> Übersicht</Link>
          {user.role === 'AZUBI' && <Link to="/dashboard" className="nav-item"><BookOpen size={18} /> Meine Berichte</Link>}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{user.fullName.charAt(0)}</div>
          <div><strong>{user.fullName}</strong><small>{user.role === 'AZUBI' ? 'Auszubildende/r' : 'Ausbilder/in'}</small></div>
          <button className="icon-button" onClick={logout} title="Abmelden"><LogOut size={17} /></button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register' | null>(null);
  const [role, setRole] = useState<Role>('AZUBI');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        email: data.get('email'), password: data.get('password'), role,
      };
      if (mode === 'register') {
        body.fullName = data.get('name');
        if (role === 'AZUBI') body.profession = data.get('profession');
      }
      const result = await api<{ user: User; accessToken: string }>(
        `/auth/${mode === 'register' ? 'register' : 'login'}`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      setSession(result.accessToken, result.user);
      toast.success('Erfolgreich angemeldet');
      navigate('/dashboard');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen'); }
    finally { setBusy(false); }
  }
  async function demo(selectedRole: Role) {
    setBusy(true);
    try {
      const result = await api<{ user: User; accessToken: string }>('/auth/demo', {
        method: 'POST', body: JSON.stringify({ role: selectedRole }),
      });
      setSession(result.accessToken, result.user);
      toast.success('Demo-Arbeitsbereich geöffnet');
      navigate('/dashboard');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Demo konnte nicht gestartet werden'); }
    finally { setBusy(false); }
  }
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link className="brand" to="/"><span className="brand-mark">A</span><span>AzubiTrack</span></Link>
        <div className="landing-actions">
          <button className="button ghost" onClick={() => setMode('login')}>Anmelden</button>
          <button className="button primary" onClick={() => setMode('register')}>Registrieren</button>
        </div>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={15} /> Digital. IHK-konform. Einfach.</span>
          <h1>Ihr digitales<br /><em>Berichtsheft.</em></h1>
          <p>Berichte schreiben, mit KI professionell formulieren und direkt zur Prüfung einreichen.</p>
          <div className="hero-buttons">
            <button className="button primary large" onClick={() => setMode('register')}>Jetzt starten <ArrowRight size={18} /></button>
            <button className="button secondary large" onClick={() => demo('AZUBI')} disabled={busy}>Als Azubi testen</button>
          </div>
        </div>
        <div className="hero-card">
          <div className="card-top"><span>Kalenderwoche 47</span><StatusBadge status="FREIGEGEBEN" /></div>
          <div className="progress-ring"><strong>32</strong><span>von 40 h</span></div>
          <div className="mini-chart"><i /><i /><i /><i /><i /></div>
          <div className="hero-card-footer"><Check size={16} /> Diese Woche freigegeben</div>
        </div>
      </section>
      {mode && (
        <div className="modal-backdrop" onMouseDown={() => setMode(null)}>
          <form className="auth-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setMode(null)}>×</button>
            <h2>{mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}</h2>
            {mode === 'register' && <input name="name" placeholder="Vollständiger Name" required />}
            <input name="email" type="email" placeholder="E-Mail-Adresse" required />
            <input name="password" type="password" minLength={8} placeholder="Passwort" required />
            {mode === 'register' && (
              <>
                <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                  <option value="AZUBI">Ich bin Auszubildende/r</option>
                  <option value="AUSBILDER">Ich bin Ausbilder/in</option>
                </select>
                {role === 'AZUBI' && <input name="profession" placeholder="Ausbildungsberuf" />}
              </>
            )}
            <button className="button primary full" disabled={busy}>{busy ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : 'Registrieren'}</button>
            {mode === 'login' && <button type="button" className="button secondary full" onClick={() => demo('AZUBI')} disabled={busy}>Demo starten</button>}
          </form>
        </div>
      )}
      <footer><span>© 2026 AzubiTrack</span><Link to="/impressum">Impressum</Link><Link to="/datenschutz">Datenschutzerklärung</Link></footer>
    </div>
  );
}

function Dashboard() {
  const user = getUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  useEffect(() => {
    api<{ reports: Report[] }>('/reports')
      .then((result) => setReports(result.reports))
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);
  async function createReport() {
    const now = new Date();
    const oneJan = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const kw = Math.ceil((((now.getTime() - oneJan.getTime()) / 86400000) + oneJan.getUTCDay() + 1) / 7);
    try {
      const result = await api<{ report: Report }>('/reports', {
        method: 'POST', body: JSON.stringify({ calendarWeek: kw, year: now.getUTCFullYear() }),
      });
      navigate(`/reports/${result.report.id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Bericht konnte nicht angelegt werden'); }
  }
  if (!user) return <Navigate to="/" />;
  return (
    <Shell user={user}>
      <header className="page-header">
        <div><span className="eyebrow">Übersicht</span><h1>Hallo, {user.fullName.split(' ')[0]}!</h1></div>
        {user.role === 'AZUBI' && <button className="button primary" onClick={createReport}><Plus size={18} /> Neuer Bericht</button>}
      </header>
      <section className="stats-grid">
        <article><span><BookOpen size={18} /></span><div><strong>{reports.length}</strong><small>Berichte gesamt</small></div></article>
        <article><span className="green"><Check size={18} /></span><div><strong>{reports.filter((r) => r.status === 'FREIGEGEBEN').length}</strong><small>Freigegeben</small></div></article>
        <article><span className="orange"><Clock3 size={18} /></span><div><strong>{reports.filter((r) => r.status === 'EINGEREICHT').length}</strong><small>In Prüfung</small></div></article>
      </section>
      <section className="panel">
        <div className="panel-header"><h2>{user.role === 'AZUBI' ? 'Meine Berichte' : 'Berichte meiner Azubis'}</h2></div>
        {loading ? <div className="empty">Berichte werden geladen…</div> :
          reports.length === 0 ? <div className="empty"><BookOpen size={32} /><h3>Noch keine Berichte</h3><p>Der erste Ausbildungsnachweis ist nur einen Klick entfernt.</p></div> :
          <div className="report-list">
            {reports.map((report) => (
              <Link className="report-row" key={report.id} to={`/reports/${report.id}`}>
                <div className="week-icon">{String(report.calendarWeek).padStart(2, '0')}</div>
                <div><strong>Kalenderwoche {report.calendarWeek}</strong><small>{report.year}</small></div>
                <StatusBadge status={report.status} />
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>}
      </section>
    </Shell>
  );
}

const categoryLabels: Record<Category, string> = {
  BETRIEB: 'Betriebliche Tätigkeiten',
  UNTERWEISUNG: 'Unterweisungen / Schulungen',
  BERUFSSCHULE: 'Berufsschule',
};

function ReportEditor() {
  const { id } = useParams();
  const user = getUser();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  useEffect(() => {
    api<{ report: Report }>(`/reports/${id}`)
      .then((result) => { setReport(result.report); setEntries(result.report.entries ?? []); setComment(result.report.ausbilderComment ?? ''); })
      .catch((error) => toast.error(error.message));
  }, [id]);
  if (!user) return <Navigate to="/" />;
  if (!report) return <Shell user={user}><div className="empty">Bericht wird geladen…</div></Shell>;
  const editable = user.role === 'AZUBI' && (report.status === 'ENTWURF' || report.status === 'ABGELEHNT');

  function updateEntry(index: number, patch: Partial<Entry>) {
    setEntries((current) => current.map((entry, i) => i === index ? { ...entry, ...patch } : entry));
  }
  function addEntry(category: Category) {
    setEntries((current) => [...current, { category, content: '', hours: 0 }]);
  }
  async function save() {
    setBusy(true);
    try {
      const result = await api<{ report: Report }>(`/reports/${id}`, { method: 'PUT', body: JSON.stringify({ entries }) });
      setReport(result.report); setEntries(result.report.entries ?? []);
      toast.success('Änderungen gespeichert');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Speichern fehlgeschlagen'); }
    finally { setBusy(false); }
  }
  async function submitReport() {
    if (!window.confirm('Bericht endgültig zur Prüfung einreichen?')) return;
    setBusy(true);
    try {
      const result = await api<{ report: Report }>(`/reports/${id}/submit`, { method: 'PATCH' });
      setReport(result.report); toast.success('Bericht wurde eingereicht');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Einreichen fehlgeschlagen'); }
    finally { setBusy(false); }
  }
  async function optimize(index: number) {
    const entry = entries[index];
    if (!entry.content.trim()) return toast.info('Bitte zuerst eine Notiz eingeben.');
    setBusy(true);
    try {
      const result = await api<{ optimizedText: string }>('/ai/optimize', {
        method: 'POST', body: JSON.stringify({ text: entry.content, category: entry.category }),
      });
      if (window.confirm(`KI-Vorschlag übernehmen?\n\n${result.optimizedText}`)) updateEntry(index, { content: result.optimizedText });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'KI-Optimierung fehlgeschlagen'); }
    finally { setBusy(false); }
  }
  async function review(decision: 'FREIGEGEBEN' | 'ABGELEHNT') {
    if (decision === 'ABGELEHNT' && !comment.trim()) return toast.error('Bitte einen Kommentar zur Ablehnung angeben.');
    setBusy(true);
    try {
      const result = await api<{ report: Report }>(`/reports/${id}/review`, { method: 'PATCH', body: JSON.stringify({ decision, comment }) });
      setReport(result.report); toast.success(decision === 'FREIGEGEBEN' ? 'Bericht freigegeben' : 'Bericht abgelehnt');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Prüfung fehlgeschlagen'); }
    finally { setBusy(false); }
  }
  async function downloadPdf() {
    if (!accessToken || !report) return;
    try {
      const response = await fetch(`/api/reports/${id}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('PDF konnte nicht erstellt werden.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Ausbildungsnachweis_KW${String(report.calendarWeek).padStart(2, '0')}_${report.year}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PDF konnte nicht erstellt werden.');
    }
  }

  return (
    <Shell user={user}>
      <header className="page-header editor-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate('/dashboard')}><ArrowLeft size={18} /></button>
          <div><span className="eyebrow">Berichtsheft</span><h1>KW {report.calendarWeek} · {report.year}</h1></div>
        </div>
        <StatusBadge status={report.status} />
      </header>
      {(['BETRIEB', 'UNTERWEISUNG', 'BERUFSSCHULE'] as Category[]).map((category) => (
        <section className="panel category-panel" key={category}>
          <div className="panel-header"><h2>{categoryLabels[category]}</h2><span>{entries.filter((e) => e.category === category).reduce((sum, e) => sum + Number(e.hours), 0)} h</span></div>
          <div className="entry-list">
            {entries.map((entry, index) => entry.category !== category ? null : (
              <div className="entry-row" key={`${category}-${index}`}>
                <textarea value={entry.content} disabled={!editable} onChange={(event) => updateEntry(index, { content: event.target.value })} placeholder="Tätigkeit oder Thema beschreiben…" />
                <div className="entry-tools">
                  {editable && <button className="button ai" onClick={() => optimize(index)} disabled={busy}><Sparkles size={16} /> Mit KI optimieren</button>}
                  <label><Clock3 size={15} /><input type="number" min="0" max="168" step="0.5" disabled={!editable} value={entry.hours} onChange={(event) => updateEntry(index, { hours: Number(event.target.value) })} /> h</label>
                  {editable && <button className="icon-button danger" onClick={() => setEntries((current) => current.filter((_, i) => i !== index))}><Trash2 size={16} /></button>}
                </div>
              </div>
            ))}
          </div>
          {editable && <button className="add-entry" onClick={() => addEntry(category)}><Plus size={17} /> Eintrag hinzufügen</button>}
        </section>
      ))}
      {editable && (
        <div className="editor-actions">
          <button className="button secondary" onClick={save} disabled={busy}>Speichern</button>
          <button className="button primary" onClick={submitReport} disabled={busy}>Zur Prüfung einreichen <ArrowRight size={18} /></button>
        </div>
      )}
      {user.role === 'AUSBILDER' && report.status === 'EINGEREICHT' && (
        <section className="panel review-panel">
          <h2>Prüfung</h2>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Kommentar (bei Ablehnung erforderlich)" />
          <div className="editor-actions">
            <button className="button reject" onClick={() => review('ABGELEHNT')} disabled={busy}>Ablehnen</button>
            <button className="button approve" onClick={() => review('FREIGEGEBEN')} disabled={busy}>Freigeben</button>
          </div>
        </section>
      )}
      {(report.status === 'FREIGEGEBEN') && <button className="button secondary pdf-button" onClick={downloadPdf}><Download size={17} /> PDF herunterladen</button>}
    </Shell>
  );
}

function Legal({ kind }: { kind: 'impressum' | 'datenschutz' }) {
  return (
    <div className="legal-page">
      <Link className="brand" to="/"><span className="brand-mark">A</span><span>AzubiTrack</span></Link>
      <h1>{kind === 'impressum' ? 'Impressum' : 'Datenschutzerklärung'}</h1>
      <p>{kind === 'impressum'
        ? 'Angaben gemäß § 5 TMG. Diese Anwendung wird als Demonstrationsprojekt betrieben.'
        : 'AzubiTrack verarbeitet personenbezogene Daten ausschließlich zur Bereitstellung des digitalen Berichtshefts. Nutzer können ihre Daten exportieren und ihr Konto über die Kontoeinstellungen löschen.'}</p>
      <Link className="button secondary" to="/">Zurück zur Startseite</Link>
    </div>
  );
}

export default function App() {
  const user = getUser();
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/reports/:id" element={<ReportEditor />} />
      <Route path="/impressum" element={<Legal kind="impressum" />} />
      <Route path="/datenschutz" element={<Legal kind="datenschutz" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
