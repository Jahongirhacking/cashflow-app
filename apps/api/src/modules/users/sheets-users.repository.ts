import { Logger } from '@nestjs/common';
import { generateId, type User } from '@finance/shared';
import { TtlCache } from '../../common/cache/ttl-cache';
import { a1 } from '../google-sheets/a1';
import type { CellValue, SheetsClient } from '../google-sheets/sheets-client';
import { type NewUser, type UserPatch, UsersRepository } from './users.repository';

const USERS_SHEET = 'Users';
const HEADERS = [
  'ID',
  'Google ID',
  'Email',
  'Name',
  'Picture',
  'Spreadsheet ID',
  'Spreadsheet name',
  'Spreadsheet verified at',
  'Created at',
  'Updated at',
];
const TTL_MS = 60_000;

interface UserRow {
  user: User;
  row: number;
}

/**
 * Production user store: a "Users" sheet inside the app-owned registry spreadsheet
 * (GOOGLE_SPREADSHEET_ID). Keeps the whole stack on Google Sheets with zero extra infrastructure.
 */
export class SheetsUsersRepository extends UsersRepository {
  private readonly logger = new Logger(SheetsUsersRepository.name);
  private readonly cache = new TtlCache();
  private ready: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly client: SheetsClient,
    private readonly spreadsheetId: string,
  ) {
    super();
  }

  async findById(id: string): Promise<User | null> {
    return (await this.rows()).find((r) => r.user.id === id)?.user ?? null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return (await this.rows()).find((r) => r.user.googleId === googleId)?.user ?? null;
  }

  create(input: NewUser): Promise<User> {
    return this.enqueue(async () => {
      const rows = await this.rows();
      const now = new Date().toISOString();
      const user: User = { ...input, id: generateId('usr'), createdAt: now, updatedAt: now };
      const row = (rows[rows.length - 1]?.row ?? 1) + 1;
      await this.client.updateValues(
        this.spreadsheetId,
        a1(USERS_SHEET, 1, row, HEADERS.length, row),
        [toCells(user)],
      );
      this.cache.invalidate('users');
      return user;
    });
  }

  update(id: string, patch: UserPatch): Promise<User | null> {
    return this.enqueue(async () => {
      const entry = (await this.rows()).find((r) => r.user.id === id);
      if (!entry) return null;
      const user: User = { ...entry.user, ...patch, updatedAt: new Date().toISOString() };
      await this.client.updateValues(
        this.spreadsheetId,
        a1(USERS_SHEET, 1, entry.row, HEADERS.length, entry.row),
        [toCells(user)],
      );
      this.cache.invalidate('users');
      return user;
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private rows(): Promise<UserRow[]> {
    return this.cache.getOrLoad('users', TTL_MS, async () => {
      await this.ensureSheet();
      const values = await this.client.getValues(
        this.spreadsheetId,
        a1(USERS_SHEET, 1, 2, HEADERS.length),
      );
      const rows: UserRow[] = [];
      values.forEach((cells, i) => {
        const user = fromCells(cells);
        if (user) rows.push({ user, row: i + 2 });
      });
      return rows;
    });
  }

  private ensureSheet(): Promise<void> {
    this.ready ??= (async () => {
      const meta = await this.client.getSpreadsheet(this.spreadsheetId);
      if (!meta.sheets.some((s) => s.title === USERS_SHEET)) {
        await this.client.addSheet(this.spreadsheetId, USERS_SHEET, HEADERS.length);
        await this.client.updateValues(
          this.spreadsheetId,
          a1(USERS_SHEET, 1, 1, HEADERS.length, 1),
          [HEADERS],
        );
        this.logger.log(
          `Created "${USERS_SHEET}" sheet in registry spreadsheet ${this.spreadsheetId}`,
        );
      }
    })().catch((error: unknown) => {
      this.ready = null;
      throw error;
    });
    return this.ready;
  }
}

function toCells(user: User): CellValue[] {
  return [
    user.id,
    user.googleId,
    user.email,
    user.name,
    user.picture ?? '',
    user.spreadsheetId ?? '',
    user.spreadsheetName ?? '',
    user.spreadsheetVerifiedAt ?? '',
    user.createdAt,
    user.updatedAt,
  ];
}

function text(cell: CellValue | undefined): string {
  return cell === null || cell === undefined ? '' : String(cell).trim();
}

function fromCells(cells: CellValue[]): User | null {
  const id = text(cells[0]);
  const googleId = text(cells[1]);
  const email = text(cells[2]);
  if (!id || !googleId || !email) return null;
  return {
    id,
    googleId,
    email,
    name: text(cells[3]),
    picture: text(cells[4]) || null,
    spreadsheetId: text(cells[5]) || null,
    spreadsheetName: text(cells[6]) || null,
    spreadsheetVerifiedAt: text(cells[7]) || null,
    createdAt: text(cells[8]) || new Date(0).toISOString(),
    updatedAt: text(cells[9]) || new Date(0).toISOString(),
  };
}
