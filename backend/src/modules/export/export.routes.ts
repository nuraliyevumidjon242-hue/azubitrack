import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { buildDataExport } from './export.service.js';

export const exportRouter = Router();

exportRouter.post(
  '/data',
  requireAuth,
  asyncHandler(async (req, res) => {
    const archive = await buildDataExport(req.user!);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="azubitrack-datenexport-${stamp}.zip"`,
    );
    res.setHeader('Content-Length', archive.length);
    res.send(archive);
  }),
);
