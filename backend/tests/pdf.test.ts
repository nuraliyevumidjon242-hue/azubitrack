import { describe, expect, it } from 'vitest';
import { formatGermanDate, formatGermanDateTime, renderReportPdf } from '../src/modules/pdf/pdf.service.js';
import type { ReportDetailDto } from '../src/modules/reports/report.service.js';

function buildReport(overrides: Partial<ReportDetailDto> = {}): ReportDetailDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    azubiId: '22222222-2222-4222-8222-222222222222',
    azubiName: 'Lukas Müller',
    profession: 'Fachinformatiker für Anwendungsentwicklung',
    calendarWeek: 48,
    year: 2026,
    status: 'FREIGEGEBEN',
    ausbilderComment: null,
    approvedAt: '2026-11-27T17:00:00.000Z',
    submittedAt: '2026-11-27T16:00:00.000Z',
    reviewedAt: '2026-11-27T17:00:00.000Z',
    createdAt: '2026-11-23T08:00:00.000Z',
    updatedAt: '2026-11-27T17:00:00.000Z',
    totalHours: 20,
    entryCount: 3,
    hoursByCategory: { BETRIEB: 12, UNTERWEISUNG: 4, BERUFSSCHULE: 4 },
    dateRange: {
      start: '2026-11-23',
      end: '2026-11-27',
      days: ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'],
    },
    trainingYear: 3,
    editable: false,
    canSubmit: false,
    canReview: false,
    approvalSignature: 'a'.repeat(64),
    entries: [
      {
        id: 'entry-1',
        category: 'BETRIEB',
        content:
          'Entwicklung eines REST-API-Endpunkts inklusive Validierung der Eingabeparameter und Dokumentation der Schnittstelle.',
        hours: 8,
        position: 0,
        createdAt: '2026-11-23T08:00:00.000Z',
        updatedAt: '2026-11-23T08:00:00.000Z',
      },
      {
        id: 'entry-2',
        category: 'BETRIEB',
        content: 'Durchführung von Unit-Tests und Code-Review mit dem Team.',
        hours: 4,
        position: 1,
        createdAt: '2026-11-23T08:00:00.000Z',
        updatedAt: '2026-11-23T08:00:00.000Z',
      },
      {
        id: 'entry-3',
        category: 'UNTERWEISUNG',
        content: 'Unterweisung zu Clean-Code-Prinzipien.',
        hours: 4,
        position: 0,
        createdAt: '2026-11-23T08:00:00.000Z',
        updatedAt: '2026-11-23T08:00:00.000Z',
      },
      {
        id: 'entry-4',
        category: 'BERUFSSCHULE',
        content: 'Berufsschule: Lernfeld 8 – Daten systemübergreifend bereitstellen.',
        hours: 4,
        position: 0,
        createdAt: '2026-11-23T08:00:00.000Z',
        updatedAt: '2026-11-23T08:00:00.000Z',
      },
    ],
    azubi: {
      id: '22222222-2222-4222-8222-222222222222',
      fullName: 'Lukas Müller',
      email: 'lukas@example.test',
      profession: 'Fachinformatiker für Anwendungsentwicklung',
      ausbildungStartDate: '2024-08-01',
    },
    ausbilder: {
      id: '33333333-3333-4333-8333-333333333333',
      fullName: 'Sabine Weber',
      email: 'sabine@example.test',
    },
    ...overrides,
  };
}

describe('PDF generation', () => {
  it('produces a valid PDF document', async () => {
    const buffer = await renderReportPdf(buildReport());
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(3000);
    expect(buffer.subarray(-6).toString()).toContain('EOF');
  });

  it('handles drafts and missing signatures', async () => {
    const buffer = await renderReportPdf(
      buildReport({
        status: 'ENTWURF',
        approvedAt: null,
        approvalSignature: null,
        ausbilder: null,
        trainingYear: null,
      }),
    );
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('adds pages for long content', async () => {
    const entries = Array.from({ length: 30 }, (_, index) => ({
      id: `entry-${index}`,
      category: 'BETRIEB' as const,
      content:
        'Ausführliche Beschreibung einer betrieblichen Tätigkeit inklusive Zielsetzung, Vorgehen und Ergebnis der durchgeführten Arbeiten im Projekt.',
      hours: 1,
      position: index,
      createdAt: '2026-11-23T08:00:00.000Z',
      updatedAt: '2026-11-23T08:00:00.000Z',
    }));
    const buffer = await renderReportPdf(
      buildReport({ entries, entryCount: entries.length, totalHours: 30 }),
    );
    const pageMatches = buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pageMatches.length).toBeGreaterThan(1);
  });

  it('formats German dates', () => {
    expect(formatGermanDate('2026-11-23')).toBe('23.11.2026');
    expect(formatGermanDate(null)).toBe('—');
    expect(formatGermanDateTime('2026-11-27T17:00:00.000Z')).toContain('27.11.2026');
  });
});
