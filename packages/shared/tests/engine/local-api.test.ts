import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AppError,
  DEMO_SPREADSHEET_URL,
  InMemorySheetsClient,
  LocalApi,
  type LocalUserStore,
  seedDemoSpreadsheet,
  type User,
} from '../../src/index';

function memoryUsers(signedIn: boolean): LocalUserStore {
  let user: User | null = signedIn
    ? {
        id: 'usr_local',
        googleId: 'g1',
        email: 'me@example.com',
        name: 'Me',
        picture: null,
        spreadsheetId: null,
        spreadsheetName: null,
        spreadsheetVerifiedAt: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      }
    : null;
  return {
    current: () => Promise.resolve(user),
    signOut: () => {
      user = null;
      return Promise.resolve();
    },
    setSpreadsheet: (userId, c) => {
      if (!user || user.id !== userId) throw new Error('no user');
      user = {
        ...user,
        spreadsheetId: c.spreadsheetId,
        spreadsheetName: c.spreadsheetName,
        spreadsheetVerifiedAt: c.verifiedAt,
      };
      return Promise.resolve(user);
    },
  };
}

function build(signedIn = true) {
  const client = new InMemorySheetsClient();
  seedDemoSpreadsheet(client);
  return { client, api: new LocalApi({ client, users: memoryUsers(signedIn) }) };
}

describe('LocalApi (the HTTP API served in-process)', () => {
  it('requires a signed-in user and reports the connection status', async () => {
    const { api } = build(false);
    await assert.rejects(
      api.request({ method: 'GET', path: '/auth/me' }),
      (e: unknown) => e instanceof AppError && e.code === 'UNAUTHORIZED',
    );
    const { api: signed } = build();
    const me = await signed.request<{ hasSpreadsheet: boolean }>({
      method: 'GET',
      path: '/auth/me',
    });
    assert.equal(me.hasSpreadsheet, false);
    const status = await signed.request<{ accessState: string }>({
      method: 'GET',
      path: '/spreadsheets/status',
    });
    assert.equal(status.accessState, 'NOT_CONNECTED');
  });

  it('connects the demo spreadsheet, then serves transactions, analytics, recurring and planning', async () => {
    const { api } = build();
    const status = await api.request<{ connected: boolean; serviceAccountEmail: string | null }>({
      method: 'POST',
      path: '/spreadsheets/connect',
      body: { spreadsheetUrl: DEMO_SPREADSHEET_URL },
    });
    assert.equal(status.connected, true);
    assert.equal(status.serviceAccountEmail, null); // user-token mode: nothing to share with

    const page = await api.request<{ total: number; items: { name: string }[] }>({
      method: 'GET',
      path: '/transactions',
      query: { pageSize: 5, type: 'EXPENSE' },
    });
    assert.ok(page.total > 0);
    assert.ok(page.items.every((t) => t.name));

    const created = await api.request<{ id: string; category: string }>({
      method: 'POST',
      path: '/transactions',
      body: {
        name: 'Taksi',
        amount: 30000,
        type: 'EXPENSE',
        paymentMethod: 'CARD',
        date: '2026-10-07',
        category: 'Transport',
      },
    });
    assert.equal(created.category, 'Transport');
    const fetched = await api.request<{ id: string }>({
      method: 'GET',
      path: `/transactions/${created.id}`,
    });
    assert.equal(fetched.id, created.id);
    await api.request({
      method: 'PATCH',
      path: `/transactions/${created.id}`,
      body: { amount: 35000 },
    });
    await api.request({ method: 'DELETE', path: `/transactions/${created.id}` });
    await assert.rejects(
      api.request({ method: 'GET', path: `/transactions/${created.id}` }),
      (e: unknown) => e instanceof AppError && e.code === 'NOT_FOUND',
    );

    const overview = await api.request<{ totalBalance: number }>({
      method: 'GET',
      path: '/analytics/overview',
      query: { period: 'all' },
    });
    assert.equal(typeof overview.totalBalance, 'number');
    const cats = await api.request<{ name: string }[]>({ method: 'GET', path: '/categories' });
    assert.ok(cats.some((c) => c.name === 'Food'));
    const schedule = await api.request<{ occurrences: unknown[] }>({
      method: 'GET',
      path: '/recurring/schedule',
      query: { month: '2026-10' },
    });
    assert.ok(Array.isArray(schedule.occurrences));
    const plan = await api.request<{ cashIsDefault: boolean }>({
      method: 'GET',
      path: '/planning/month',
      query: { rate: 18 },
    });
    assert.equal(plan.cashIsDefault, true);
    const investments = await api.request<{ positions: unknown[] }>({
      method: 'GET',
      path: '/investments',
    });
    assert.equal(investments.positions.length, 3);
  });

  it('validates input and rejects routes that need the server', async () => {
    const { api } = build();
    await api.request({
      method: 'POST',
      path: '/spreadsheets/connect',
      body: { spreadsheetUrl: DEMO_SPREADSHEET_URL },
    });
    await assert.rejects(
      api.request({ method: 'POST', path: '/transactions', body: { name: '' } }),
      (e: unknown) =>
        e instanceof AppError && e.code === 'VALIDATION_ERROR' && (e.details?.length ?? 0) > 0,
    );
    await assert.rejects(
      api.request({ method: 'POST', path: '/transactions/import/preview' }),
      (e: unknown) => e instanceof AppError && e.code === 'CONFIGURATION_ERROR',
    );
    await assert.rejects(
      api.request({ method: 'GET', path: '/nope' }),
      (e: unknown) => e instanceof AppError && e.code === 'NOT_FOUND',
    );
  });
});
