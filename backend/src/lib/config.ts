import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

// Load the monorepo root .env first, then a backend-local .env (if present).
loadEnv({ path: resolve(process.cwd(), '../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: optionalString,
  SQLITE_PATH: z.string().default('./data/azubitrack.db'),
  REDIS_URL: optionalString,
  MIGRATIONS_DIR: optionalString,

  JWT_ACCESS_SECRET: z
    .string()
    .min(16)
    .default('dev-access-secret-change-me-please-0123456789abcdef'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default('dev-refresh-secret-change-me-please-0123456789abcdef'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  AI_PROVIDER: z.enum(['openai', 'gemini', 'local']).default('openai'),
  OPENAI_API_KEY: optionalString,
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
  AI_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(1000),
  AI_MAX_OUTPUT_CHARS: z.coerce.number().int().positive().default(500),

  DEMO_TTL_MINUTES: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
});

export type AppConfig = {
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  logLevel: string;
  corsOrigins: string[];
  databaseUrl?: string;
  sqlitePath: string;
  redisUrl?: string;
  migrationsDir?: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
  ai: {
    provider: 'openai' | 'gemini' | 'local';
    openAiKey?: string;
    openAiBaseUrl: string;
    openAiModel: string;
    geminiKey?: string;
    geminiModel: string;
    maxInputChars: number;
    maxOutputChars: number;
  };
  demo: { ttlMinutes: number };
  rateLimit: { authMax: number; aiMax: number };
};

let cached: AppConfig | null = null;

function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  const env = parsed.data;

  if (env.NODE_ENV === 'production') {
    const required: Array<keyof typeof env> = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
    for (const key of required) {
      const value = process.env[key];
      if (!value || value.length < 32) {
        throw new Error(
          `Environment variable ${key} must be set to a random value of at least 32 characters in production.`,
        );
      }
    }
  }

  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigins: env.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    databaseUrl: env.DATABASE_URL,
    sqlitePath: env.SQLITE_PATH,
    redisUrl: env.REDIS_URL,
    migrationsDir: env.MIGRATIONS_DIR,
    jwtAccessSecret: env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET,
    accessTokenTtlMinutes: env.ACCESS_TOKEN_TTL_MINUTES,
    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    ai: {
      provider: env.AI_PROVIDER,
      openAiKey: env.OPENAI_API_KEY,
      openAiBaseUrl: env.OPENAI_BASE_URL.replace(/\/+$/, ''),
      openAiModel: env.OPENAI_MODEL,
      geminiKey: env.GEMINI_API_KEY,
      geminiModel: env.GEMINI_MODEL,
      maxInputChars: env.AI_MAX_INPUT_CHARS,
      maxOutputChars: env.AI_MAX_OUTPUT_CHARS,
    },
    demo: { ttlMinutes: env.DEMO_TTL_MINUTES },
    rateLimit: { authMax: env.AUTH_RATE_LIMIT_MAX, aiMax: env.AI_RATE_LIMIT_MAX },
  };
}

export function getConfig(): AppConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

/** Test helper — clears the memoized configuration. */
export function resetConfig(): void {
  cached = null;
}
