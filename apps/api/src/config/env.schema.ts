import { z } from 'zod';

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

/**
 * Hosting dashboards often hand over a bare host ("api.example.com", "api-xyz.northflank.app"), a quoted
 * value or a trailing slash. Normalise those before validating so a deploy does not fail on them.
 */
function normaliseUrl(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  let v = value.trim().replace(/^['"]+|['"]+$/g, '');
  if (v === '') return v;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = `https://${v}`;
  return v.replace(/\/+$/, '');
}
const lenientUrl = z.preprocess(normaliseUrl, z.url());
const optionalUrl = z.preprocess(
  normaliseUrl,
  z
    .string()
    .transform((value) => (value === '' ? undefined : value))
    .optional()
    .pipe(z.url().optional()),
);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_PUBLIC_URL: lenientUrl.default('http://localhost:3000'),
  APP_WEB_URL: lenientUrl.default('http://localhost:8081'),
  CORS_ORIGINS: optionalString,

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('30d'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: optionalString,
  AUTH_NATIVE_SCHEME: z
    .string()
    .regex(/^[a-z][a-z0-9+.-]*$/i)
    .default('finance'),

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_OAUTH_REDIRECT_URI: optionalUrl,

  GOOGLE_SERVICE_ACCOUNT_EMAIL: optionalString.pipe(z.email().optional()),
  GOOGLE_PRIVATE_KEY: optionalString.transform((value) => value?.replace(/\\n/g, '\n')),
  GOOGLE_SPREADSHEET_ID: optionalString,
  DATA_DIR: z.string().default('./data'),
  /** `memory` serves a seeded in-memory spreadsheet for local development without Google credentials. */
  SHEETS_BACKEND: z.enum(['google', 'memory']).default('google'),

  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
});

export type Env = z.infer<typeof envSchema>;

/** Used by @nestjs/config to fail fast on an invalid environment. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => {
        const key = issue.path.join('.') || '(root)';
        // Show the rejected value for non-secret settings so a deploy log explains itself.
        const value = raw[key];
        const shown =
          /SECRET|KEY|PRIVATE/i.test(key) || typeof value !== 'string'
            ? ''
            : ` (received "${value.slice(0, 120)}")`;
        return `  - ${key}: ${issue.message}${shown}`;
      })
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
