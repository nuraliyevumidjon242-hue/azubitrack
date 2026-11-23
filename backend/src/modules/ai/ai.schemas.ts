import { z } from 'zod';

export const optimizeSchema = z.object({
  text: z
    .string()
    .trim()
    .min(3, 'Bitte geben Sie mindestens drei Zeichen ein.')
    .max(4000, 'Der Text ist zu lang.'),
  category: z.enum(['BETRIEB', 'UNTERWEISUNG', 'BERUFSSCHULE']),
  profession: z.string().trim().max(160).optional(),
});

export type OptimizeInput = z.infer<typeof optimizeSchema>;
