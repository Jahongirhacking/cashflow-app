import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileUsersRepository } from './file-users.repository';

describe('FileUsersRepository', () => {
  let dir: string;
  let repo: FileUsersRepository;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'finance-users-'));
    repo = new FileUsersRepository(path.join(dir, 'nested', 'users.json'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const input = {
    googleId: 'g-1',
    email: 'a@example.com',
    name: 'A',
    picture: null,
    spreadsheetId: null,
    spreadsheetName: null,
    spreadsheetVerifiedAt: null,
  };

  it('creates, finds and updates users, persisting to disk', async () => {
    const created = await repo.create(input);
    expect(created.id).toMatch(/^usr_/);
    expect(await repo.findByGoogleId('g-1')).toEqual(created);
    expect(await repo.findById(created.id)).toEqual(created);

    const updated = await repo.update(created.id, {
      spreadsheetId: 'sheet-1',
      spreadsheetName: 'Budget',
    });
    expect(updated?.spreadsheetId).toBe('sheet-1');

    const fresh = new FileUsersRepository(path.join(dir, 'nested', 'users.json'));
    expect((await fresh.findById(created.id))?.spreadsheetName).toBe('Budget');
    const raw = JSON.parse(await readFile(path.join(dir, 'nested', 'users.json'), 'utf8')) as {
      users: unknown[];
    };
    expect(raw.users).toHaveLength(1);
  });

  it('serialises concurrent writes', async () => {
    await Promise.all([1, 2, 3, 4, 5].map((n) => repo.create({ ...input, googleId: `g-${n}` })));
    const fresh = new FileUsersRepository(path.join(dir, 'nested', 'users.json'));
    const found = await Promise.all([1, 2, 3, 4, 5].map((n) => fresh.findByGoogleId(`g-${n}`)));
    expect(found.every(Boolean)).toBe(true);
  });

  it('returns null for unknown ids', async () => {
    expect(await repo.findById('nope')).toBeNull();
    expect(await repo.update('nope', { name: 'x' })).toBeNull();
  });
});
