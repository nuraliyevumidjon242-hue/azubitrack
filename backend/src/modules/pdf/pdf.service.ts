import PDFDocument from 'pdfkit';
import { CATEGORY_LABELS, type Category } from '../../lib/types.js';
import type { ReportDetailDto } from '../reports/report.service.js';

const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#d1d5db';
const HEADER_BG = '#1f2937';
const CATEGORY_BG = '#eef2ff';
const ACCENT = '#4f46e5';
const TOTALS_BG = '#f9fafb';

const PAGE_MARGIN_X = 48;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN_X * 2;
const HOURS_WIDTH = 72;
const CELL_PADDING = 6;

export function formatGermanDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso.length > 10 ? iso : `${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatGermanDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(date);
}

function formatHours(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value);
}

export function renderReportPdf(report: ReportDetailDto): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 46, bottom: 64, left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
      bufferPages: true,
      info: {
        Title: `Ausbildungsnachweis KW ${report.calendarWeek}/${report.year}`,
        Author: report.azubi.fullName,
        Subject: `Ausbildungsnachweis ${report.azubi.profession ?? ''}`.trim(),
        Creator: 'AzubiTrack',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawDocument(doc, report);
      drawFooters(doc, report);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function drawDocument(doc: PDFKit.PDFDocument, report: ReportDetailDto): void {
  const pageBottom = doc.page.height - doc.page.margins.bottom;

  // --- Header -------------------------------------------------------------
  doc.rect(PAGE_MARGIN_X, 46, CONTENT_WIDTH, 4).fill(ACCENT);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(20);
  doc.text('Ausbildungsnachweis', PAGE_MARGIN_X, 62, { width: CONTENT_WIDTH * 0.7 });
  doc.font('Helvetica').fontSize(9).fillColor(MUTED);
  doc.text('gemäß § 13 Abs. 7 des Berufsbildungsgesetzes (BBiG)', PAGE_MARGIN_X, 88, {
    width: CONTENT_WIDTH * 0.7,
  });

  doc.font('Helvetica-Bold').fontSize(9).fillColor(ACCENT);
  doc.text('AzubiTrack', PAGE_MARGIN_X, 62, { width: CONTENT_WIDTH, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor(MUTED);
  doc.text('Digitales Berichtsheft', PAGE_MARGIN_X, 75, { width: CONTENT_WIDTH, align: 'right' });

  let y = 110;
  doc
    .moveTo(PAGE_MARGIN_X, y)
    .lineTo(PAGE_MARGIN_X + CONTENT_WIDTH, y)
    .lineWidth(1)
    .strokeColor(LINE)
    .stroke();
  y += 14;

  // --- Meta grid ----------------------------------------------------------
  const colWidth = CONTENT_WIDTH / 2 - 10;
  const metaLeft: Array<[string, string]> = [
    ['Auszubildende/r', report.azubi.fullName],
    ['Ausbildungsberuf', report.azubi.profession ?? '—'],
    ['Ausbildungsjahr', report.trainingYear ? `${report.trainingYear}. Ausbildungsjahr` : '—'],
  ];
  const metaRight: Array<[string, string]> = [
    ['Kalenderwoche', `KW ${report.calendarWeek} / ${report.year}`],
    ['Zeitraum', `${formatGermanDate(report.dateRange.start)} – ${formatGermanDate(report.dateRange.end)}`],
    ['Ausbilder/in', report.ausbilder?.fullName ?? '—'],
  ];

  const metaStartY = y;
  for (let index = 0; index < metaLeft.length; index += 1) {
    drawMeta(doc, metaLeft[index]!, PAGE_MARGIN_X, y, colWidth);
    drawMeta(doc, metaRight[index]!, PAGE_MARGIN_X + CONTENT_WIDTH / 2 + 10, y, colWidth);
    y += 30;
  }
  void metaStartY;

  y += 6;
  doc
    .moveTo(PAGE_MARGIN_X, y)
    .lineTo(PAGE_MARGIN_X + CONTENT_WIDTH, y)
    .lineWidth(0.5)
    .strokeColor(LINE)
    .stroke();
  y += 16;

  // --- Table --------------------------------------------------------------
  const drawHeader = (): void => {
    doc.rect(PAGE_MARGIN_X, y, CONTENT_WIDTH, 24).fill(HEADER_BG);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9.5);
    doc.text('Tätigkeiten im Berichtszeitraum', PAGE_MARGIN_X + CELL_PADDING, y + 8, {
      width: CONTENT_WIDTH - HOURS_WIDTH - CELL_PADDING * 2,
    });
    doc.text('Stunden', PAGE_MARGIN_X + CONTENT_WIDTH - HOURS_WIDTH - CELL_PADDING, y + 8, {
      width: HOURS_WIDTH,
      align: 'right',
    });
    y += 24;
  };

  const ensureSpace = (height: number): void => {
    if (y + height <= pageBottom) return;
    doc.addPage();
    y = doc.page.margins.top;
    drawHeader();
  };

  drawHeader();

  const categories: Category[] = ['BETRIEB', 'UNTERWEISUNG', 'BERUFSSCHULE'];
  const entriesByCategory = new Map<Category, ReportDetailDto['entries']>(
    categories.map((category) => [
      category,
      report.entries
        .filter((entry) => entry.category === category)
        .sort((a, b) => a.position - b.position),
    ]),
  );

  for (const category of categories) {
    const categoryEntries = entriesByCategory.get(category) ?? [];
    const categoryHours = categoryEntries.reduce((sum, entry) => sum + entry.hours, 0);

    ensureSpace(26);
    doc.rect(PAGE_MARGIN_X, y, CONTENT_WIDTH, 22).fill(CATEGORY_BG);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9);
    doc.text(CATEGORY_LABELS[category], PAGE_MARGIN_X + CELL_PADDING, y + 7, {
      width: CONTENT_WIDTH - HOURS_WIDTH - CELL_PADDING * 2,
      lineBreak: false,
      ellipsis: true,
    });
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9);
    doc.text(`${formatHours(categoryHours)} h`, PAGE_MARGIN_X + CONTENT_WIDTH - HOURS_WIDTH - CELL_PADDING, y + 7, {
      width: HOURS_WIDTH,
      align: 'right',
      lineBreak: false,
    });
    y += 22;

    if (categoryEntries.length === 0) {
      ensureSpace(24);
      doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(9);
      doc.text('Keine Einträge erfasst.', PAGE_MARGIN_X + CELL_PADDING, y + 7, {
        width: CONTENT_WIDTH - CELL_PADDING * 2,
      });
      y += 24;
      doc
        .moveTo(PAGE_MARGIN_X, y)
        .lineTo(PAGE_MARGIN_X + CONTENT_WIDTH, y)
        .lineWidth(0.5)
        .strokeColor(LINE)
        .stroke();
      continue;
    }

    for (const entry of categoryEntries) {
      doc.font('Helvetica').fontSize(9.5);
      const textWidth = CONTENT_WIDTH - HOURS_WIDTH - CELL_PADDING * 2;
      const textHeight = doc.heightOfString(entry.content, { width: textWidth, lineGap: 1.5 });
      const rowHeight = Math.max(textHeight + CELL_PADDING * 2, 22);

      ensureSpace(rowHeight);

      doc.fillColor(INK).font('Helvetica').fontSize(9.5);
      doc.text(entry.content, PAGE_MARGIN_X + CELL_PADDING, y + CELL_PADDING, {
        width: textWidth,
        lineGap: 1.5,
      });
      doc.fillColor(INK).font('Helvetica').fontSize(9.5);
      doc.text(formatHours(entry.hours), PAGE_MARGIN_X + CONTENT_WIDTH - HOURS_WIDTH - CELL_PADDING, y + CELL_PADDING, {
        width: HOURS_WIDTH,
        align: 'right',
      });

      y += rowHeight;
      doc
        .moveTo(PAGE_MARGIN_X, y)
        .lineTo(PAGE_MARGIN_X + CONTENT_WIDTH, y)
        .lineWidth(0.5)
        .strokeColor(LINE)
        .stroke();
    }
  }

  // --- Totals -------------------------------------------------------------
  ensureSpace(74);
  y += 14;
  const totalHeight = 58;
  doc.rect(PAGE_MARGIN_X, y, CONTENT_WIDTH, totalHeight).fill(TOTALS_BG).stroke(LINE);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(10);
  doc.text('Gesamtstunden', PAGE_MARGIN_X + 10, y + 10);
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
  doc.text(
    `Betrieb: ${formatHours(report.hoursByCategory.BETRIEB)} h  ·  Unterweisung: ${formatHours(
      report.hoursByCategory.UNTERWEISUNG,
    )} h  ·  Berufsschule: ${formatHours(report.hoursByCategory.BERUFSSCHULE)} h`,
    PAGE_MARGIN_X + 10,
    y + 26,
    { width: CONTENT_WIDTH - 120 },
  );
  doc.font('Helvetica-Bold').fontSize(18).fillColor(ACCENT);
  doc.text(`${formatHours(report.totalHours)} h`, PAGE_MARGIN_X + CONTENT_WIDTH - 110, y + 18, {
    width: 100,
    align: 'right',
  });
  y += totalHeight + 26;

  // --- Approval status ----------------------------------------------------
  if (report.status === 'FREIGEGEBEN' && report.approvedAt) {
    ensureSpace(30);
    doc.fillColor('#047857').font('Helvetica-Bold').fontSize(9);
    doc.text(
      `Digital freigegeben am ${formatGermanDateTime(report.approvedAt)}`,
      PAGE_MARGIN_X,
      y,
    );
    if (report.approvalSignature) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(7.5);
      doc.text(`Prüfsumme: ${report.approvalSignature.slice(0, 32)}…`, PAGE_MARGIN_X, y + 12);
    }
    y += 34;
  }

  // --- Signatures ---------------------------------------------------------
  ensureSpace(90);
  y += 12;
  const signatureWidth = CONTENT_WIDTH / 2 - 16;
  const lineY = y + 34;
  doc
    .moveTo(PAGE_MARGIN_X, lineY)
    .lineTo(PAGE_MARGIN_X + signatureWidth, lineY)
    .lineWidth(0.8)
    .strokeColor(INK)
    .stroke();
  doc
    .moveTo(PAGE_MARGIN_X + CONTENT_WIDTH / 2 + 16, lineY)
    .lineTo(PAGE_MARGIN_X + CONTENT_WIDTH, lineY)
    .lineWidth(0.8)
    .strokeColor(INK)
    .stroke();

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(9);
  doc.text(report.azubi.fullName, PAGE_MARGIN_X, lineY + 6, { width: signatureWidth });
  doc.font('Helvetica').fontSize(8).fillColor(MUTED);
  doc.text('Unterschrift Auszubildende/r', PAGE_MARGIN_X, lineY + 19, { width: signatureWidth });

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(9);
  doc.text(report.ausbilder?.fullName ?? '—', PAGE_MARGIN_X + CONTENT_WIDTH / 2 + 16, lineY + 6, {
    width: signatureWidth,
  });
  doc.font('Helvetica').fontSize(8).fillColor(MUTED);
  doc.text(
    report.approvedAt
      ? `Unterschrift Ausbilder/in · freigegeben am ${formatGermanDate(report.approvedAt)}`
      : 'Unterschrift Ausbilder/in',
    PAGE_MARGIN_X + CONTENT_WIDTH / 2 + 16,
    lineY + 19,
    { width: signatureWidth },
  );

  doc.y = lineY + 40;
}

function drawMeta(
  doc: PDFKit.PDFDocument,
  [label, value]: [string, string],
  x: number,
  y: number,
  width: number,
): void {
  doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(label.toUpperCase(), x, y, { width });
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(value, x, y + 10, {
    width,
    lineBreak: false,
    ellipsis: true,
  });
}

function drawFooters(doc: PDFKit.PDFDocument, report: ReportDetailDto): void {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const bottom = doc.page.height - 40;
    doc
      .moveTo(PAGE_MARGIN_X, bottom - 12)
      .lineTo(PAGE_MARGIN_X + CONTENT_WIDTH, bottom - 12)
      .lineWidth(0.5)
      .strokeColor(LINE)
      .stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5);
    doc.text(
      `AzubiTrack · Ausbildungsnachweis ${report.azubi.fullName} · KW ${report.calendarWeek}/${report.year}`,
      PAGE_MARGIN_X,
      bottom,
      { width: CONTENT_WIDTH - 80, lineBreak: false },
    );
    doc.text(`Seite ${index + 1} von ${range.count}`, PAGE_MARGIN_X + CONTENT_WIDTH - 80, bottom, {
      width: 80,
      align: 'right',
      lineBreak: false,
    });
  }
}
