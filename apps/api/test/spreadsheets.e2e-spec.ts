import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Paginated, SpreadsheetStatus, Transaction } from '@finance/shared';
import cookieParser from 'cookie-parser';
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
      'Investments',
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
    expect(sheets.grid(SHEET_ID, 'Categories').length).toBe(18); // header + 17 defaults

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
});
