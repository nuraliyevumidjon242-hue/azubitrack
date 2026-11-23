import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { linkAzubi } from '../auth/auth.service.js';
import { getAzubiOverview, getReport } from '../reports/report.service.js';

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get(
  '/azubis',
  requireRole('AUSBILDER'),
  asyncHandler(async (req, res) => {
    res.json({ azubis: await getAzubiOverview(req.user!.id) });
  }),
);

const linkSchema = z.object({
  email: z.string().trim().email('Bitte eine gültige E-Mail-Adresse angeben.'),
});

userRouter.post(
  '/link-azubi',
  requireRole('AUSBILDER'),
  asyncHandler(async (req, res) => {
    const { email } = linkSchema.parse(req.body);
    const azubi = await linkAzubi(req.user!.id, email);
    res.status(201).json({ azubi });
  }),
);

userRouter.get(
  '/azubis/:id/reports/:reportId',
  requireRole('AUSBILDER'),
  asyncHandler(async (req, res) => {
    const report = await getReport(String(req.params.reportId), req.user!);
    res.json({ report });
  }),
);
