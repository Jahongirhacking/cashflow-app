#!/usr/bin/env node
/**
 * Diagnose the service-account ↔ Google Sheets connection without starting the API.
 *   pnpm --filter @finance/api check:sheets [spreadsheet-url]
 * Reads apps/api/.env, obtains a token, checks that the Sheets API is enabled and,
 * when a URL is given, reads that spreadsheet's title and tabs. Prints no secrets.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JWT } = require('google-auth-library');
const { parse } = require('dotenv');
const { extractSpreadsheetId } = require('@finance/shared');

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...loadEnv(path.join(apiDir, '.env')), ...process.env };
const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = (env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
const url = process.argv[2];

function loadEnv(file) {
  try {
    return parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!email || !key)
  fail('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY are not set in apps/api/.env');
console.log(`Service account: ${email}`);

const client = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
try {
  await client.authorize();
  console.log('✔ Authentication: token obtained (private key is valid)');
} catch (error) {
  fail(
    `Authentication failed: ${error.message}. Check GOOGLE_PRIVATE_KEY (keep the quotes, \\n escapes are fine).`,
  );
}

const spreadsheetId = url ? extractSpreadsheetId(url) : null;
if (url && !spreadsheetId) fail(`"${url}" is not a Google Sheets URL`);

const probeId = spreadsheetId ?? '1DoesNotExist000000000000000000000000000000';
try {
  const { data } = await client.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(probeId)}`,
    params: { fields: 'properties.title,sheets.properties.title' },
  });
  console.log('✔ Google Sheets API: enabled');
  console.log(`✔ Spreadsheet "${data.properties?.title}" is readable`);
  console.log(`  Tabs: ${(data.sheets ?? []).map((s) => s.properties?.title).join(', ')}`);
} catch (error) {
  const status = error.response?.status;
  const body = error.response?.data?.error;
  const reasons = (body?.details ?? []).map((d) => d.reason).filter(Boolean);
  const disabled =
    status === 403 &&
    (reasons.includes('SERVICE_DISABLED') ||
      /has not been used|is disabled/i.test(body?.message ?? ''));
  if (disabled) {
    const project = /project (\d+)/.exec(body?.message ?? '')?.[1];
    fail(
      `Google Sheets API is NOT enabled for this service account's project.\n  Enable it: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview${project ? `?project=${project}` : ''}\n  then wait a minute and retry.`,
    );
  }
  console.log('✔ Google Sheets API: enabled');
  if (!spreadsheetId) {
    console.log('ℹ Pass a spreadsheet URL to verify that the service account can read it.');
    process.exit(0);
  }
  if (status === 403) fail(`The spreadsheet is not shared with ${email} (give it Editor access).`);
  if (status === 404) fail('Spreadsheet not found: check the URL.');
  fail(`Google error ${status ?? ''}: ${body?.message ?? error.message}`);
}
