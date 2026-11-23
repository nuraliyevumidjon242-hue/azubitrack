import { z } from 'zod';

export const categorySchema = z.enum(['BETRIEB', 'UNTERWEISUNG', 'BERUFSSCHULE']);

export const entryInputSchema = z.object({
  id: z.string().uuid().optional(),
  category: categorySchema,
  content: z
    .string()
    .trim()
    .min(1, 'Bitte einen Inhalt angeben.')
    .max(2000, 'Ein Eintrag darf höchstens 2000 Zeichen enthalten.'),
  hours: z.coerce
    .number()
    .min(0, 'Stunden dürfen nicht negativ sein.')
    .max(168, 'Ungültige Stundenzahl.')
    .refine((value) => Math.round(value * 100) / 100 === value, {
      message: 'Maximal zwei Nachkommastellen erlaubt.',
    }),
});

export const createReportSchema = z.object({
  calendarWeek: z.coerce.number().int().min(1).max(53),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const updateReportSchema = z.object({
  entries: z.array(entryInputSchema).max(80, 'Zu viele Einträge.'),
});

export const reviewSchema = z
  .object({
    decision: z.enum(['FREIGEGEBEN', 'ABGELEHNT']),
    comment: z.string().trim().max(2000, 'Der Kommentar ist zu lang.').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'ABGELEHNT' && (!data.comment || data.comment.length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comment'],
        message: 'Bei einer Ablehnung ist ein Kommentar erforderlich.',
      });
    }
  });

export const listReportsQuerySchema = z.object({
  azubiId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Ungültige Berichts-ID.') });

export type EntryInput = z.infer<typeof entryInputSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
