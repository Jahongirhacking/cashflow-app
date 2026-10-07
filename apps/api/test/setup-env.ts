import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Runs before each e2e file is loaded. Values here win over apps/api/.env because
 * process.env takes precedence in @nestjs/config, and NODE_ENV=test makes AppConfigModule
 * ignore env files entirely.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '3999';
process.env.JWT_SECRET = 'e2e-secret-e2e-secret-e2e-secret-1234567890';
process.env.APP_WEB_URL = 'http://localhost:8081';
process.env.API_PUBLIC_URL = 'http://localhost:3000';
process.env.AUTH_NATIVE_SCHEME = 'finance';
process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'finance-e2e-'));
for (const key of [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_SPREADSHEET_ID',
  'CORS_ORIGINS',
  'COOKIE_DOMAIN',
]) {
  delete process.env[key];
}
