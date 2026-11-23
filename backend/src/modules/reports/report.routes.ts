import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { renderReportPdf } from '../pdf/pdf.service.js';
import {
  idParamSchema,
  listReportsQuerySchema,
  reviewSchema,
  updateReportSchema,
} from './report.schemas.js';
import { createReportSchema } from './report.schemas.js';
import {
  createReport,
  getReport,
  getReportForPdf,
  listReports,
  reviewReport,
  submitReport,
  updateReport,
} from './report.service.js';

export const reportRouter = Router();

reportRouter.use(requireAuth);

reportRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listReportsQuerySchema.parse(req.query);
    res.json({ reports: await listReports(req.user!, query) });
  }),
);

reportRouter.post(
  '/',
  requireRole('AZUBI'),
  asyncHandler(async (req, res) => {
    const input = createReportSchema.parse(req.body);
    const report = await createReport(req.user!, input);
    res.status(201).json({ report });
  }),
);

reportRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json({ report: await getReport(id, req.user!) });
  }),
);

reportRouter.put(
  '/:id',
  requireRole('AZUBI'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { entries } = updateReportSchema.parse(req.body);
    res.json({ report: await updateReport(id, req.user!, entries) });
  }),
);

reportRouter.patch(
  '/:id/submit',
  requireRole('AZUBI'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json({ report: await submitReport(id, req.user!) });
  }),
);

reportRouter.patch(
  '/:id/review',
  requireRole('AUSBILDER'),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = reviewSchema.parse(req.body);
    res.json({ report: await reviewReport(id, req.user!, input) });
  }),
);

reportRouter.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const report = await getReportForPdf(id, req.user!);
    const pdf = await renderReportPdf(report);
    const filename = `Ausbildungsnachweis_KW${String(report.calendarWeek).padStart(2, '0')}_${report.year}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  }),
);
