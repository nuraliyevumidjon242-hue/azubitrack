import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Das Passwort muss mindestens 8 Zeichen lang sein.')
  .max(128, 'Das Passwort darf höchstens 128 Zeichen lang sein.')
  .regex(/[A-Za-z]/, 'Das Passwort muss mindestens einen Buchstaben enthalten.')
  .regex(/[0-9]/, 'Das Passwort muss mindestens eine Zahl enthalten.');

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte ein gültiges Datum (JJJJ-MM-TT) angeben.')
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), {
    message: 'Ungültiges Datum.',
  });

export const registerSchema = z
  .object({
    email: z.string().trim().email('Bitte eine gültige E-Mail-Adresse angeben.').max(254),
    password: passwordSchema,
    fullName: z
      .string()
      .trim()
      .min(2, 'Bitte den vollständigen Namen angeben.')
      .max(120, 'Der Name ist zu lang.'),
    role: z.enum(['AZUBI', 'AUSBILDER']),
    profession: z.string().trim().max(160).optional(),
    ausbildungStartDate: isoDateSchema.optional(),
    ausbilderEmail: z.string().trim().email('Ungültige E-Mail des Ausbilders.').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'AZUBI' && !data.profession) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['profession'],
        message: 'Bitte den Ausbildungsberuf angeben.',
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().email('Bitte eine gültige E-Mail-Adresse angeben.'),
  password: z.string().min(1, 'Bitte das Passwort eingeben.'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export const demoSchema = z.object({
  role: z.enum(['AZUBI', 'AUSBILDER']).optional(),
  sessionId: z.string().min(8).max(64).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DemoInput = z.infer<typeof demoSchema>;
