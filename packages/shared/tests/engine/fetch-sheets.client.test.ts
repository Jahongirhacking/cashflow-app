import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError, FetchSheetsClient } from '../../src/index';

interface Call {
  url: string;
  method: string;
  auth: string;
  body?: string;
}

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: Call[] = [];
  const fetch = (
    url: string,
    init: { method: string; headers: Record<string, string>; body?: string },
  ) => {
    calls.push({
      url,
      method: init.method,
      auth: init.headers.Authorization ?? '',
      body: init.body,
    });
    const next = responses.shift() ?? { status: 200, body: {} };
    return Promise.resolve({
      ok: next.status < 400,
      status: next.status,
      text: () => Promise.resolve(JSON.stringify(next.body)),
    });
  };
  return { fetch, calls };
}

describe('FetchSheetsClient', () => {
  it('sends bearer requests with the same options as the service-account client', async () => {
    const { fetch, calls } = fakeFetch([
      { status: 200, body: { values: [['a', 1]] } },
      { status: 200, body: { valueRanges: [{ values: [[1]] }, {}] } },
    ]);
    const client = new FetchSheetsClient({ getAccessToken: () => Promise.resolve('tok'), fetch });
    const values = await client.getValues('sheet1', "'Xarajatlar'!A1:B");
    assert.deepEqual(values, [['a', 1]]);
    assert.equal(calls[0]?.method, 'GET');
    assert.equal(calls[0]?.auth, 'Bearer tok');
    assert.match(
      calls[0]?.url ?? '',
      /spreadsheets\/sheet1\/values\/'Xarajatlar'!A1%3AB\?valueRenderOption=UNFORMATTED_VALUE/,
    );
    const batch = await client.batchGetValues('sheet1', ['A1:A2', 'B1:B2']);
    assert.deepEqual(batch, [[[1]], []]);
    assert.match(calls[1]?.url ?? '', /ranges=A1%3AA2&ranges=B1%3AB2/);
  });

  it('refreshes the token once on 401 and maps Google errors to AppError codes', async () => {
    const tokens = ['stale', 'fresh'];
    const { fetch, calls } = fakeFetch([
      {
        status: 401,
        body: { error: { message: 'Invalid Credentials', status: 'UNAUTHENTICATED' } },
      },
      { status: 200, body: { values: [] } },
      {
        status: 403,
        body: {
          error: { message: 'The caller does not have permission', status: 'PERMISSION_DENIED' },
        },
      },
    ]);
    const client = new FetchSheetsClient({
      getAccessToken: ({ force } = {}) =>
        Promise.resolve(force ? (tokens[1] as string) : (tokens[0] as string)),
      fetch,
      sleep: () => Promise.resolve(),
    });
    await client.getValues('s', 'A1');
    assert.equal(calls[0]?.auth, 'Bearer stale');
    assert.equal(calls[1]?.auth, 'Bearer fresh');
    await assert.rejects(
      client.getValues('s', 'A1'),
      (e: unknown) => e instanceof AppError && e.code === 'SPREADSHEET_ACCESS_DENIED',
    );
  });

  it('retries 5xx with backoff and gives up with GOOGLE_API_ERROR', async () => {
    const { fetch, calls } = fakeFetch([
      { status: 503, body: {} },
      { status: 503, body: {} },
      { status: 503, body: {} },
    ]);
    const client = new FetchSheetsClient({
      getAccessToken: () => Promise.resolve('t'),
      fetch,
      sleep: () => Promise.resolve(),
    });
    await assert.rejects(
      client.getSpreadsheet('s'),
      (e: unknown) => e instanceof AppError && e.code === 'GOOGLE_API_ERROR',
    );
    assert.equal(calls.length, 3);
  });
});
