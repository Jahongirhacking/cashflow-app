import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DEFAULT_CATEGORIES,
  type Paginated,
  type SpreadsheetStatus,
  type Transaction,
} from '@finance/shared';
import cookieParser from 'cookie-parser';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AppConfigService } from '../src/config/app-config.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { InMemorySheetsClient } from '../src/modules/google-sheets/in-memory-sheets.client';
import { SheetsClient } from '../src/modules/google-sheets/sheets-client';
import { UsersService } from '../src/modules/users/users.service';

const SHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0`;

describe('Spreadsheets & transactions (e2e, in-memory Sheets)', () => {
  let app: INestApplication;
  let server: Server;
  let sheets: InMemorySheetsClient;
  let auth: string;

  beforeAll(async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'finance-bot@example.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = 'test-key';
    sheets = new InMemorySheetsClient();
    sheets.seed(SHEET_ID, 'Mening byudjetim', [
      {
        title: 'Xarajatlar',
        rows: [
          [
            "To'lov Nomi",
            'Narx (+ Kirim / - Chiqim)',
            "To'lov turi (N/P)",
            'Sana',
            'Vaqt',
            'Kategoriya',
            '',
            'Naqd',
            4997500,
          ],
          ['Oylik', 5000000, 'P', 46290, 0.375, 'Oylik', '', 'Plastik', 0],
          ['Metro', -2500, 'N', '03.10.2026', '08:15', 'Transport', '', 'Jami', 4997500],
          [],
          ['Ovqat', '-50 000', 'N', 46295, '', 'Ovqat', '', 'Chiqim', -52500],
        ],
      },
    ]);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SheetsClient)
      .useValue(sheets)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    server = app.getHttpServer() as Server;
    expect(app.get(AppConfigService).serviceAccountEmail).toBe(
      'finance-bot@example.iam.gserviceaccount.com',
    );
    const user = await app.get(UsersService).findOrCreateFromGoogle({
      googleId: 'g-e2e',
      email: 'e2e@example.com',
      name: 'E2E',
      picture: null,
    });
    auth = `Bearer ${app.get(AuthService).issueSession(user.id).accessToken}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports NOT_CONNECTED before setup and blocks data routes', async () => {
    const status = await request(server)
      .get('/spreadsheets/status')
      .set('Authorization', auth)
      .expect(200);
    expect(status.body).toMatchObject({
      connected: false,
      accessState: 'NOT_CONNECTED',
      serviceAccountEmail: 'finance-bot@example.iam.gserviceaccount.com',
    });
    const tx = await request(server).get('/transactions').set('Authorization', auth).expect(412);
    expect(tx.body).toMatchObject({ code: 'SPREADSHEET_NOT_CONNECTED' });
  });

  it('rejects non-sheet urls and inaccessible spreadsheets', async () => {
    const bad = await request(server)
      .post('/spreadsheets/connect')
      .set('Authorization', auth)
      .send({ spreadsheetUrl: 'https://example.com/nope' })
      .expect(400);
    expect(bad.body).toMatchObject({ code: 'VALIDATION_ERROR' });

    sheets.setAccessDenied(SHEET_ID, true);
    const denied = await request(server)
      .post('/spreadsheets/connect')
      .set('Authorization', auth)
      .send({ spreadsheetUrl: SHEET_URL })
      .expect(403);
    expect(denied.body).toMatchObject({
      code: 'SPREADSHEET_ACCESS_DENIED',
      message: 'The Finance app cannot access this spreadsheet.',
    });
    sheets.setAccessDenied(SHEET_ID, false);
  });

  it('connects, reuses the legacy sheet and creates the missing app sheets without touching data', async () => {
    const res = await request(server)
      .post('/spreadsheets/connect')
      .set('Authorization', auth)
      .send({ spreadsheetUrl: SHEET_URL })
      .expect(200);
    const status = res.body as SpreadsheetStatus;
    expect(status).toMatchObject({
      connected: true,
      accessState: 'OK',
      spreadsheetId: SHEET_ID,
      spreadsheetName: 'Mening byudjetim',
    });

    const meta = await sheets.getSpreadsheet(SHEET_ID);
    expect(meta.sheets.map((s) => s.title)).toEqual([
      'Xarajatlar',
      'Settings',
      'Recurring',
      'Categories',
    ]);

    const grid = sheets.grid(SHEET_ID, 'Xarajatlar');
    expect(grid[0]?.slice(0, 9)).toEqual([
      "To'lov Nomi",
      'Narx (+ Kirim / - Chiqim)',
      "To'lov turi (N/P)",
      'Sana',
      'Vaqt',
      'Kategoriya',
      '',
      'Naqd',
      4997500,
    ]);
    expect(grid[0]?.[9]).toBe('Finance ID'); // app block placed at J, after the summary cells in H:I
    expect(grid[1]?.slice(0, 6)).toEqual(['Oylik', 5000000, 'P', 46290, 0.375, 'Oylik']);
    expect(sheets.grid(SHEET_ID, 'Categories').length).toBe(DEFAULT_CATEGORIES.length + 1); // header + defaults

    const info = await request(server)
      .get('/spreadsheets/info')
      .set('Authorization', auth)
      .expect(200);
    expect(info.body).toMatchObject({ transactionsSheet: 'Xarajatlar', title: 'Mening byudjetim' });
  });

  it('reads legacy rows into the normalised model and backfills ids once', async () => {
    const res = await request(server).get('/transactions').set('Authorization', auth).expect(200);
    const page = res.body as Paginated<Transaction>;
    expect(page.total).toBe(3);
    expect(page.items.map((t) => t.name)).toEqual(['Metro', 'Ovqat', 'Oylik']); // newest first
    const salary = page.items[2] as Transaction;
    expect(salary).toMatchObject({
      type: 'INCOME',
      amount: 5000000,
      paymentMethod: 'CARD',
      date: '2026-09-25',
      time: '09:00',
      category: 'Oylik',
    });
    const metro = page.items[0] as Transaction;
    expect(metro).toMatchObject({
      type: 'EXPENSE',
      amount: 2500,
      paymentMethod: 'CASH',
      date: '2026-10-03',
      time: '08:15',
    });
    const food = page.items[1] as Transaction;
    expect(food).toMatchObject({ type: 'EXPENSE', amount: 50000, date: '2026-09-30', time: null });
    expect(page.items.every((t) => t.id.startsWith('txn_'))).toBe(true);

    const grid = sheets.grid(SHEET_ID, 'Xarajatlar');
    expect(grid[1]?.[9]).toBe(salary.id);
    expect(grid[4]?.[9]).toBe(food.id);
    expect(grid[1]?.[7]).toBe('Plastik'); // summary cells untouched

    const callsBefore = sheets.calls.length;
    await request(server).get('/transactions?type=EXPENSE').set('Authorization', auth).expect(200);
    expect(sheets.calls.length).toBe(callsBefore); // served from cache
  });

  it('creates, updates and deletes transactions in the legacy sheet', async () => {
    const created = await request(server)
      .post('/transactions')
      .set('Authorization', auth)
      .send({
        name: 'Taksi',
        amount: 30000,
        type: 'EXPENSE',
        paymentMethod: 'CARD',
        date: '2026-10-07',
        time: '19:20',
        category: 'Transport',
        clientId: 'client-abc-123',
      })
      .expect(201);
    const tx = created.body as Transaction;
    expect(tx.id).toBe('txn_client-abc-123');
    const grid = sheets.grid(SHEET_ID, 'Xarajatlar');
    expect(grid[5]?.slice(0, 6)).toEqual([
      'Taksi',
      -30000,
      'P',
      '2026-10-07',
      '19:20',
      'Transport',
    ]);
    expect(grid[5]?.[9]).toBe('txn_client-abc-123');

    // retried request with the same clientId does not duplicate
    await request(server)
      .post('/transactions')
      .set('Authorization', auth)
      .send({
        name: 'Taksi',
        amount: 30000,
        type: 'EXPENSE',
        paymentMethod: 'CARD',
        date: '2026-10-07',
        category: 'Transport',
        clientId: 'client-abc-123',
      })
      .expect(201);
    expect(sheets.grid(SHEET_ID, 'Xarajatlar').length).toBe(6);

    const updated = await request(server)
      .patch(`/transactions/${tx.id}`)
      .set('Authorization', auth)
      .send({ amount: 35000, note: 'Yandex' })
      .expect(200);
    expect(updated.body).toMatchObject({ amount: 35000, note: 'Yandex', type: 'EXPENSE' });
    expect(sheets.grid(SHEET_ID, 'Xarajatlar')[5]?.[1]).toBe(-35000);
    expect(sheets.grid(SHEET_ID, 'Xarajatlar')[5]?.[10]).toBe('Yandex');

    await request(server).delete(`/transactions/${tx.id}`).set('Authorization', auth).expect(204);
    expect(sheets.grid(SHEET_ID, 'Xarajatlar').length).toBe(6); // row cleared, not removed
    expect(sheets.grid(SHEET_ID, 'Xarajatlar')[5]?.[0]).toBeNull();
    await request(server).get(`/transactions/${tx.id}`).set('Authorization', auth).expect(404);

    const list = await request(server).get('/transactions').set('Authorization', auth).expect(200);
    expect((list.body as Paginated<Transaction>).total).toBe(3);
  });

  it('applies bulk category, type and delete actions to selected transactions', async () => {
    const post = (body: Record<string, unknown>) =>
      request(server).post('/transactions').set('Authorization', auth).send(body).expect(201);
    const a = (
      await post({
        name: 'Bulk A',
        amount: 1000,
        type: 'EXPENSE',
        paymentMethod: 'CARD',
        date: '2026-10-08',
        category: 'Transport',
      })
    ).body as { id: string };
    const b = (
      await post({
        name: 'Bulk B',
        amount: 2000,
        type: 'EXPENSE',
        paymentMethod: 'CASH',
        date: '2026-10-08',
        category: 'Transport',
      })
    ).body as { id: string };
    const c = (
      await post({
        name: 'Bulk C',
        amount: 3000,
        type: 'EXPENSE',
        paymentMethod: 'CARD',
        date: '2026-10-09',
        category: 'Transport',
      })
    ).body as { id: string };
    const bulk = (body: Record<string, unknown>) =>
      request(server).post('/transactions/bulk').set('Authorization', auth).send(body);

    let res = await bulk({
      action: 'setCategory',
      ids: [a.id, b.id, 'txn_missing'],
      category: 'Food',
    }).expect(200);
    expect(res.body).toEqual({ affected: 2, missing: 1 });
    res = await bulk({ action: 'setType', ids: [a.id, c.id], type: 'INCOME' }).expect(200);
    expect(res.body).toEqual({ affected: 2, missing: 0 });
    const list = (
      await request(server).get('/transactions?search=Bulk').set('Authorization', auth).expect(200)
    ).body as { items: { name: string; category: string; type: string; amount: number }[] };
    expect(list.items.map((t) => [t.name, t.category, t.type, t.amount]).sort()).toEqual([
      ['Bulk A', 'Food', 'INCOME', 1000],
      ['Bulk B', 'Food', 'EXPENSE', 2000],
      ['Bulk C', 'Transport', 'INCOME', 3000],
    ]);
    // the legacy sheet keeps the sign convention: income positive, expense negative
    const grid = sheets.grid(SHEET_ID, 'Xarajatlar');
    const rowA = grid.find((r) => r[0] === 'Bulk A');
    expect(rowA?.[1]).toBe(1000);
    expect(grid.find((r) => r[0] === 'Bulk B')?.[1]).toBe(-2000);

    res = await bulk({ action: 'delete', ids: [a.id, b.id, c.id, c.id] }).expect(200);
    expect(res.body).toEqual({ affected: 3, missing: 0 });
    const after = (
      await request(server).get('/transactions?search=Bulk').set('Authorization', auth).expect(200)
    ).body as { total: number };
    expect(after.total).toBe(0);
    await bulk({ action: 'delete', ids: [] }).expect(400);
    await bulk({ action: 'setCategory', ids: [a.id] }).expect(400);
  });

  it('serves categories (seeded defaults) and transaction facets', async () => {
    const cats = await request(server).get('/categories').set('Authorization', auth).expect(200);
    const list = cats.body as { name: string; type: string; isDefault: boolean }[];
    expect(list.length).toBe(DEFAULT_CATEGORIES.length);
    expect(
      list
        .filter((c) => c.name === 'Deposit')
        .map((c) => c.type)
        .sort(),
    ).toEqual(['EXPENSE', 'INCOME']);
    expect(list.find((c) => c.name === 'Food')).toMatchObject({ type: 'EXPENSE', isDefault: true });

    const created = await request(server)
      .post('/categories')
      .set('Authorization', auth)
      .send({ name: 'Kredit', type: 'EXPENSE', kind: 'FIXED' })
      .expect(201);
    expect(created.body).toMatchObject({ name: 'Kredit', kind: 'FIXED', isDefault: false });
    await request(server)
      .post('/categories')
      .set('Authorization', auth)
      .send({ name: 'kredit', type: 'EXPENSE' })
      .expect(409);
    const id = (created.body as { id: string }).id;
    await request(server)
      .patch(`/categories/${id}`)
      .set('Authorization', auth)
      .send({ name: 'Kredit (Kia)' })
      .expect(200);
    await request(server).delete(`/categories/${id}`).set('Authorization', auth).expect(204);
    expect(
      ((await request(server).get('/categories').set('Authorization', auth)).body as unknown[])
        .length,
    ).toBe(DEFAULT_CATEGORIES.length);

    const facets = await request(server)
      .get('/transactions/facets')
      .set('Authorization', auth)
      .expect(200);
    expect(facets.body).toMatchObject({ total: 3, minDate: '2026-09-25', maxDate: '2026-10-03' });
    expect(
      (facets.body as { categories: { name: string }[] }).categories.map((c) => c.name).sort(),
    ).toEqual(['Ovqat', 'Oylik', 'Transport']);
  });

  it('adds missing default categories to an already-initialised spreadsheet without duplicates', async () => {
    const OLD_ID = '1OlderSheetInitialisedBeforeNewDefaults0000000';
    const now = new Date().toISOString();
    sheets.seed(OLD_ID, 'Old budget', [
      {
        title: 'Transactions',
        rows: [
          [
            "To'lov nomi",
            'Narx',
            "To'lov turi",
            'Sana',
            'Vaqt',
            'Kategoriya',
            'Finance ID',
            'Izoh',
            'Takroriy ID',
            'Yaratilgan',
            'Yangilangan',
          ],
        ],
      },
      { title: 'Investments', rows: [['ID']] },
      { title: 'Recurring', rows: [['ID']] },
      {
        title: 'Categories',
        rows: [
          ['ID', 'Name', 'Type', 'Kind', 'Icon', 'Color', 'Default', 'Created at', 'Updated at'],
          ['cat_1', 'Salary', 'INCOME', '', 'briefcase', '', 'TRUE', now, now],
          ['cat_2', 'deposit', 'EXPENSE', 'VARIABLE', '', '', 'FALSE', now, now],
          ['cat_3', 'Taxi', 'EXPENSE', 'VARIABLE', '', '', 'FALSE', now, now],
        ],
      },
      {
        title: 'Settings',
        rows: [
          ['Key', 'Value'],
          ['schemaVersion', '1'],
          ['transactions.sheet', 'Transactions'],
          ['transactions.format', 'app'],
          ['transactions.appColumn', '7'],
          ['categories.seeded', 'true'],
        ],
      },
    ]);
    // Simulate a user who connected this sheet before the new defaults shipped: no reconnect, just a request.
    await app.get(UsersService).setSpreadsheet(
      (
        await app.get(UsersService).findOrCreateFromGoogle({
          googleId: 'g-e2e',
          email: 'e2e@example.com',
          name: 'E2E',
          picture: null,
        })
      ).id,
      { spreadsheetId: OLD_ID, spreadsheetName: 'Old budget', verifiedAt: now },
    );
    const res = await request(server).get('/categories').set('Authorization', auth).expect(200);
    const list = res.body as { name: string; type: string }[];
    // 3 existing (Salary + deposit expense already present, Taxi custom) + defaults that were missing
    expect(list.length).toBe(DEFAULT_CATEGORIES.length - 2 + 3);
    expect(
      list.filter((c) => c.name.toLowerCase() === 'deposit' && c.type === 'EXPENSE').length,
    ).toBe(1);
    expect(list.filter((c) => c.name === 'Salary').length).toBe(1);
    expect(list.some((c) => c.name === 'Crypto' && c.type === 'INCOME')).toBe(true);
    // reconnecting again is a no-op for categories
    await request(server)
      .post('/spreadsheets/reconnect')
      .set('Authorization', auth)
      .send({ spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${OLD_ID}/edit` })
      .expect(200);
    expect(
      ((await request(server).get('/categories').set('Authorization', auth)).body as unknown[])
        .length,
    ).toBe(DEFAULT_CATEGORIES.length - 2 + 3);
    // switch back to the main sheet for the remaining tests
    await request(server)
      .post('/spreadsheets/reconnect')
      .set('Authorization', auth)
      .send({ spreadsheetUrl: SHEET_URL })
      .expect(200);
  });

  it('manages recurring rules, schedules and reminder ticks', async () => {
    const created = await request(server)
      .post('/recurring')
      .set('Authorization', auth)
      .send({
        name: 'Kia Credit',
        amount: 3760000,
        type: 'EXPENSE',
        category: 'Credit',
        paymentMethod: 'CARD',
        frequency: 'MONTHLY',
        dayOfPeriod: 18,
        startDate: '2026-01-18',
      })
      .expect(201);
    const rule = created.body as { id: string; nextDate: string | null };
    expect(rule.nextDate).toMatch(/^\d{4}-\d{2}-18$/);
    await request(server)
      .post('/recurring')
      .set('Authorization', auth)
      .send({
        name: 'Salary',
        amount: 17413296,
        type: 'INCOME',
        category: 'Salary',
        paymentMethod: 'CARD',
        frequency: 'MONTHLY',
        dayOfPeriod: 5,
        startDate: '2026-01-05',
      })
      .expect(201);
    const once = await request(server)
      .post('/recurring')
      .set('Authorization', auth)
      .send({
        name: 'Contract instalment',
        amount: 1000000,
        type: 'EXPENSE',
        category: 'Other',
        frequency: 'ONCE',
        startDate: '2026-10-25',
      })
      .expect(201);
    expect((once.body as { dayOfPeriod: number | null }).dayOfPeriod).toBeNull();

    const list = await request(server).get('/recurring').set('Authorization', auth).expect(200);
    expect((list.body as unknown[]).length).toBe(3);

    const schedule = await request(server)
      .get('/recurring/schedule?month=2026-10')
      .set('Authorization', auth)
      .expect(200);
    const occ = (
      schedule.body as { occurrences: { name: string; status: string; dueDate: string }[] }
    ).occurrences;
    expect(occ.map((o) => [o.name, o.dueDate])).toEqual([
      ['Salary', '2026-10-05'],
      ['Kia Credit', '2026-10-18'],
      ['Contract instalment', '2026-10-25'],
    ]);

    // reminders: ticking never writes a transaction
    const txBefore = (
      (await request(server).get('/transactions').set('Authorization', auth)).body as {
        total: number;
      }
    ).total;
    const ticked = await request(server)
      .post(`/recurring/${rule.id}/done`)
      .set('Authorization', auth)
      .send({ dueDate: '2026-10-18', done: true })
      .expect(200);
    const kia = (
      ticked.body as {
        occurrences: {
          name: string;
          status: string;
          markedDone: boolean;
          transactionId: string | null;
        }[];
      }
    ).occurrences.find((o) => o.name === 'Kia Credit');
    expect(kia).toMatchObject({ status: 'paid', markedDone: true, transactionId: null });
    expect(
      (ticked.body as { totals: { expensePaid: number; expenseDue: number } }).totals,
    ).toMatchObject({
      expensePaid: 3760000,
      expenseDue: 1000000,
    });
    const txAfter = (
      (await request(server).get('/transactions').set('Authorization', auth)).body as {
        total: number;
      }
    ).total;
    expect(txAfter).toBe(txBefore);
    const unticked = await request(server)
      .post(`/recurring/${rule.id}/done`)
      .set('Authorization', auth)
      .send({ dueDate: '2026-10-18', done: false })
      .expect(200);
    expect(
      (unticked.body as { occurrences: { name: string; status: string }[] }).occurrences.find(
        (o) => o.name === 'Kia Credit',
      )?.status,
    ).toBe('due');

    await request(server)
      .patch(`/recurring/${rule.id}`)
      .set('Authorization', auth)
      .send({ isActive: false })
      .expect(200);
    await request(server)
      .delete(`/recurring/${(once.body as { id: string }).id}`)
      .set('Authorization', auth)
      .expect(204);
    expect(
      ((await request(server).get('/recurring').set('Authorization', auth)).body as unknown[])
        .length,
    ).toBe(2);
  });

  it('serves analytics and a month plan', async () => {
    const overview = await request(server)
      .get('/analytics/overview?period=all')
      .set('Authorization', auth)
      .expect(200);
    const body = overview.body as {
      summary: { income: number; expenses: number };
      totalBalance: number;
      topExpenseCategories: { category: string }[];
      insights: unknown[];
    };
    expect(body.summary.income).toBe(5000000);
    expect(body.summary.expenses).toBeGreaterThan(0);
    expect(body.totalBalance).toBe(body.summary.income - body.summary.expenses);
    expect(body.topExpenseCategories.length).toBeGreaterThan(0);
    const monthly = await request(server)
      .get('/analytics/monthly?months=3')
      .set('Authorization', auth)
      .expect(200);
    expect((monthly.body as unknown[]).length).toBe(3);
    const fv = await request(server)
      .get('/analytics/fixed-variable?period=all')
      .set('Authorization', auth)
      .expect(200);
    expect((fv.body as { fixed: number }).fixed).toBeGreaterThanOrEqual(0);
    await request(server)
      .get('/analytics/categories?period=12m&type=INCOME')
      .set('Authorization', auth)
      .expect(200);
    await request(server)
      .get('/analytics/trend?period=month')
      .set('Authorization', auth)
      .expect(200);
    await request(server)
      .get('/analytics/overview?period=bogus')
      .set('Authorization', auth)
      .expect(400);

    const plan = await request(server)
      .get('/planning/month?month=2026-10&cash=20000000&rate=18')
      .set('Authorization', auth)
      .expect(200);
    const p = plan.body as {
      cashOnHand: number;
      annualRatePercent: number;
      recurringIncome: { total: number };
      recommendations: unknown[];
      variable: { basis: string };
    };
    expect(p.cashOnHand).toBe(20000000);
    expect(p.annualRatePercent).toBe(18);
    expect(p.recurringIncome.total).toBe(17413296);
    expect(Array.isArray(p.recommendations)).toBe(true);
    const defaulted = await request(server)
      .get('/planning/month?month=2026-10')
      .set('Authorization', auth)
      .expect(200);
    expect((defaulted.body as { cashIsDefault: boolean; cashOnHand: number }).cashIsDefault).toBe(
      true,
    );
  });

  it('imports an .xlsx history with preview, duplicate skipping and category creation', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Export');
    ws.addRow([]);
    ws.addRow(["To'lov Nomi", 'Narx', "To'lov turi", 'Sana', 'Vaqt', 'Kategoriya']);
    ws.addRow(['Avtobus', "-1,400so'm", 'N', '18.09.2023', '12:15', 'Transport']);
    ws.addRow(['Bozorliq', "-18,000so'm", 'P', null, null, "Oziq-ovqat & Ro'zg'orlik"]);
    ws.addRow(['Dadam', "937,417so'm", 'N', '19.09.2023', null, 'Oilaviy xarajatlar']);
    ws.addRow(['Metro', "-2,500so'm", 'N', '03.10.2026', '08:15', 'Transport']); // already in the sheet → duplicate
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const preview = await request(server)
      .post('/transactions/import/preview')
      .set('Authorization', auth)
      .attach('file', buffer, 'history.xlsx')
      .expect(200);
    const p = preview.body as {
      rows: { name: string; duplicate: boolean; date: string }[];
      duplicates: number;
      newCategories: string[];
      income: number;
      expenses: number;
    };
    expect(p.rows.map((r) => [r.name, r.date, r.duplicate])).toEqual([
      ['Avtobus', '2023-09-18', false],
      ['Bozorliq', '2023-09-18', false],
      ['Dadam', '2023-09-19', false],
      ['Metro', '2026-10-03', true],
    ]);
    expect(p.duplicates).toBe(1);
    expect(p.newCategories).toEqual(['Oilaviy xarajatlar', "Oziq-ovqat & Ro'zg'orlik"]);
    expect(p.income).toBe(937417);
    expect(p.expenses).toBe(19400);

    const before = (await request(server).get('/transactions').set('Authorization', auth)).body as {
      total: number;
    };
    const commit = await request(server)
      .post('/transactions/import')
      .set('Authorization', auth)
      .send({
        rows: p.rows,
        skipDuplicates: true,
        categoryMap: { "Oziq-ovqat & Ro'zg'orlik": 'Food' },
      })
      .expect(200);
    expect(commit.body).toMatchObject({
      imported: 3,
      skipped: 1,
      categoriesCreated: ['Oilaviy xarajatlar'],
    });
    const after = (
      await request(server).get('/transactions?pageSize=100').set('Authorization', auth)
    ).body as { total: number; items: { name: string; category: string }[] };
    expect(after.total).toBe(before.total + 3);
    expect(after.items.find((t) => t.name === 'Bozorliq')?.category).toBe('Food');
    // the mapping is remembered for the next upload
    const again = await request(server)
      .post('/transactions/import/preview')
      .set('Authorization', auth)
      .attach('file', buffer, 'history.xlsx')
      .expect(200);
    expect(
      (
        again.body as {
          categories: { name: string; suggested: string | null; source: string | null }[];
        }
      ).categories.find((c) => c.name === "Oziq-ovqat & Ro'zg'orlik"),
    ).toMatchObject({ suggested: 'Food', source: 'saved' });
    const cats = (await request(server).get('/categories').set('Authorization', auth)).body as {
      name: string;
      type: string;
      kind: string | null;
    }[];
    expect(cats.find((c) => c.name === 'Oilaviy xarajatlar')).toMatchObject({ type: 'INCOME' });

    await request(server)
      .post('/transactions/import/preview')
      .set('Authorization', auth)
      .attach('file', Buffer.from('nope'), 'notes.txt')
      .expect(400);
    await request(server)
      .post('/transactions/import/preview')
      .set('Authorization', auth)
      .expect(400);
  });

  it('exports an .xlsx that the importer reads back as full duplicates', async () => {
    const res = await request(server)
      .get('/transactions/export')
      .set('Authorization', auth)
      .buffer()
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toMatch(
      /finance-transactions-\d{4}-\d{2}-\d{2}\.xlsx/,
    );
    const buffer = res.body as Buffer;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws?.getRow(2).getCell(1).value).toBe("To'lov Nomi");
    const all = (await request(server).get('/transactions?pageSize=100').set('Authorization', auth))
      .body as { total: number; items: { name: string; amount: number; type: string }[] };
    expect((ws?.rowCount ?? 0) - 2).toBe(all.total);
    const metro = all.items.find((t) => t.name === 'Metro');
    const metroRow = [...Array(ws?.rowCount ?? 0).keys()]
      .map((i) => ws?.getRow(i + 1))
      .find((r) => r?.getCell(1).value === 'Metro');
    expect(metroRow?.getCell(2).value).toBe(
      metro?.type === 'EXPENSE' ? -(metro?.amount ?? 0) : metro?.amount,
    );
    expect(metroRow?.getCell(3).value).toBe('N');
    expect(metroRow?.getCell(4).value).toBeInstanceOf(Date);

    const preview = await request(server)
      .post('/transactions/import/preview')
      .set('Authorization', auth)
      .attach('file', buffer, 'finance-transactions.xlsx')
      .expect(200);
    const p = preview.body as {
      rows: { duplicate: boolean }[];
      duplicates: number;
      skippedRows: number;
    };
    expect(p.rows.length).toBe(all.total);
    expect(p.skippedRows).toBe(0);
    expect(p.duplicates).toBe(all.total);
  });

  it('renames categories on export with a many-to-one mapping', async () => {
    // Defaults come from the remembered import mapping, inverted (file "Oziq-ovqat & Ro'zg'orlik" → Food).
    const initial = (
      await request(server)
        .get('/transactions/export/categories')
        .set('Authorization', auth)
        .expect(200)
    ).body as { map: Record<string, string>; categories: { name: string }[]; fileNames: string[] };
    expect(initial.map.Food).toBe("Oziq-ovqat & Ro'zg'orlik");
    expect(initial.categories.some((c) => c.name === 'Transport')).toBe(true);
    expect(initial.fileNames).toContain("Oziq-ovqat & Ro'zg'orlik");

    const saved = (
      await request(server)
        .put('/transactions/export/categories')
        .set('Authorization', auth)
        .send({ Food: 'Oziq-ovqat', Ovqat: 'Oziq-ovqat', Transport: 'Transport' })
        .expect(200)
    ).body as { map: Record<string, string> };
    expect(saved.map).toEqual({ Food: 'Oziq-ovqat', Ovqat: 'Oziq-ovqat' }); // identity entries dropped

    const res = await request(server)
      .get('/transactions/export')
      .set('Authorization', auth)
      .buffer()
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as Buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const categoriesInFile = new Set<string>();
    for (let r = 3; r <= (ws?.rowCount ?? 0); r += 1)
      categoriesInFile.add(String(ws?.getRow(r).getCell(6).value));
    expect(categoriesInFile.has('Oziq-ovqat')).toBe(true);
    expect(categoriesInFile.has('Food')).toBe(false);
    expect(categoriesInFile.has('Ovqat')).toBe(false);
    expect(categoriesInFile.has('Transport')).toBe(true);

    await request(server)
      .put('/transactions/export/categories')
      .set('Authorization', auth)
      .send({ Food: '' })
      .expect(400);
  });

  it('validates input', async () => {
    const res = await request(server)
      .post('/transactions')
      .set('Authorization', auth)
      .send({
        name: '',
        amount: -5,
        type: 'EXPENSE',
        paymentMethod: 'CARD',
        date: '2026-13-01',
        category: 'x',
      })
      .expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect((res.body as { details: { path: string }[] }).details.map((d) => d.path)).toEqual([
      'name',
      'amount',
      'date',
    ]);
  });

  it('surfaces lost access as SPREADSHEET_ACCESS_DENIED on verify and data routes', async () => {
    sheets.setAccessDenied(SHEET_ID, true);
    const verify = await request(server)
      .post('/spreadsheets/verify')
      .set('Authorization', auth)
      .expect(200);
    expect(verify.body).toMatchObject({ connected: false, accessState: 'ACCESS_DENIED' });
    // bust the table cache by writing (fails) then reading
    const create = await request(server)
      .post('/transactions')
      .set('Authorization', auth)
      .send({
        name: 'X',
        amount: 1,
        type: 'EXPENSE',
        paymentMethod: 'CASH',
        date: '2026-10-07',
        category: 'Other',
      })
      .expect(403);
    expect(create.body).toMatchObject({ code: 'SPREADSHEET_ACCESS_DENIED' });
    sheets.setAccessDenied(SHEET_ID, false);
    const again = await request(server)
      .post('/spreadsheets/verify')
      .set('Authorization', auth)
      .expect(200);
    expect(again.body).toMatchObject({ connected: true, accessState: 'OK' });
  });

  it('derives investments from Deposit, Crypto and Stocks transactions', async () => {
    const post = (body: Record<string, unknown>) =>
      request(server).post('/transactions').set('Authorization', auth).send(body).expect(201);
    await post({
      name: 'Bank deposit',
      amount: 10000000,
      type: 'EXPENSE',
      paymentMethod: 'CARD',
      date: '2026-08-01',
      category: 'Deposit',
    });
    await post({
      name: 'Deposit interest',
      amount: 150000,
      type: 'INCOME',
      paymentMethod: 'CARD',
      date: '2026-10-01',
      category: 'Deposit',
    });
    await post({
      name: 'Buy BTC',
      amount: 2000000,
      type: 'EXPENSE',
      paymentMethod: 'CARD',
      date: '2026-10-02',
      category: 'Crypto',
    });
    await post({
      name: 'Sell BTC',
      amount: 2600000,
      type: 'INCOME',
      paymentMethod: 'CARD',
      date: '2026-10-03',
      category: 'crypto',
    });

    const overview = await request(server)
      .get('/investments')
      .set('Authorization', auth)
      .expect(200);
    const body = overview.body as {
      positions: {
        type: string;
        invested: number;
        returned: number;
        net: number;
        transactionCount: number;
      }[];
      summary: {
        invested: number;
        returned: number;
        net: number;
        transactionCount: number;
        activeTypes: number;
      };
      monthly: { month: string }[];
    };
    expect(body.positions.map((p) => p.type)).toEqual(['DEPOSIT', 'CRYPTO', 'STOCK']);
    expect(body.positions[0]).toMatchObject({
      invested: 10000000,
      returned: 150000,
      net: -9850000,
      transactionCount: 2,
    });
    expect(body.positions[1]).toMatchObject({
      invested: 2000000,
      returned: 2600000,
      net: 600000,
      transactionCount: 2,
    });
    expect(body.positions[2]).toMatchObject({ invested: 0, returned: 0, transactionCount: 0 });
    expect(body.summary).toEqual({
      invested: 12000000,
      returned: 2750000,
      net: -9250000,
      transactionCount: 4,
      activeTypes: 2,
    });
    expect(body.monthly).toHaveLength(12);
    // the old CRUD endpoints are gone: investments are a view, not a store
    await request(server).post('/investments').set('Authorization', auth).send({}).expect(404);
  });

  it('grows the sheet when an import runs past its grid and skips rows already imported', async () => {
    const before = (await request(server).get('/transactions').set('Authorization', auth)).body as {
      total: number;
    };
    const rowCountBefore = (await sheets.getSpreadsheet(SHEET_ID)).sheets.find(
      (s) => s.title === 'Xarajatlar',
    )?.rowCount;
    expect(rowCountBefore).toBe(1000);
    const row = (i: number) => ({
      sourceRow: i + 3,
      name: `Bulk ${i}`,
      amount: 1000 + i,
      type: 'EXPENSE',
      paymentMethod: 'CASH',
      date: `2024-0${1 + (i % 9)}-1${i % 9}`,
      time: `0${i % 10}:30`,
      category: 'Transport',
    });
    const all = Array.from({ length: 1200 }, (_, i) => row(i));
    // chunk 1 fits in the grid, chunk 2 crosses it, chunk 3 only lands in the appended rows
    for (let c = 0; c < 3; c += 1) {
      const res = await request(server)
        .post('/transactions/import')
        .set('Authorization', auth)
        .send({ rows: all.slice(c * 400, (c + 1) * 400), skipDuplicates: true, categoryMap: {} })
        .expect(200);
      expect(res.body).toMatchObject({ imported: 400, skipped: 0 });
    }
    expect(sheets.calls.some((call) => call.startsWith('appendRows'))).toBe(true);
    const rowCountAfter = (await sheets.getSpreadsheet(SHEET_ID)).sheets.find(
      (s) => s.title === 'Xarajatlar',
    )?.rowCount;
    expect(rowCountAfter).toBeGreaterThanOrEqual(before.total + 1200);
    const after = (await request(server).get('/transactions').set('Authorization', auth)).body as {
      total: number;
    };
    expect(after.total).toBe(before.total + 1200);

    // re-sending the same file (as after an interrupted import) imports nothing twice
    const again = await request(server)
      .post('/transactions/import')
      .set('Authorization', auth)
      .send({ rows: all.slice(400, 800), skipDuplicates: true, categoryMap: {} })
      .expect(200);
    expect(again.body).toMatchObject({ imported: 0, skipped: 400 });
  });
});
