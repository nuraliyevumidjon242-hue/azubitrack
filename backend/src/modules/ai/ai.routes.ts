import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { optimizeSchema } from './ai.schemas.js';
import { optimizeText } from './ai.service.js';

export const aiRouter = Router();

aiRouter.post(
  '/optimize',
  requireAuth,
  requireRole('AZUBI'),
  asyncHandler(async (req, res) => {
    const input = optimizeSchema.parse(req.body);
    const result = await optimizeText({
      text: input.text,
      category: input.category,
      profession: input.profession ?? req.user!.profession ?? undefined,
    });
    res.json(result);
  }),
);
