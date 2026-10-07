import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Logger } from '@nestjs/common';
import { generateId, type User, userSchema } from '@finance/shared';
import { z } from 'zod';
import { type NewUser, type UserPatch, UsersRepository } from './users.repository';

const fileSchema = z.object({ users: z.array(userSchema) });

/**
 * Development store: a JSON file under DATA_DIR. Writes are serialised and atomic
 * (temp file + rename) so a crash never leaves a half-written registry.
 */
export class FileUsersRepository extends UsersRepository {
  private readonly logger = new Logger(FileUsersRepository.name);
  private cache: User[] | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {
    super();
  }

  async findById(id: string): Promise<User | null> {
    const users = await this.load();
    return users.find((user) => user.id === id) ?? null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const users = await this.load();
    return users.find((user) => user.googleId === googleId) ?? null;
  }

  create(input: NewUser): Promise<User> {
    return this.enqueue(async () => {
      const users = await this.load();
      const now = new Date().toISOString();
      const user: User = { ...input, id: generateId('usr'), createdAt: now, updatedAt: now };
      users.push(user);
      await this.persist(users);
      return user;
    });
  }

  update(id: string, patch: UserPatch): Promise<User | null> {
    return this.enqueue(async () => {
      const users = await this.load();
      const index = users.findIndex((user) => user.id === id);
      const existing = users[index];
      if (!existing) return null;
      const updated: User = { ...existing, ...patch, updatedAt: new Date().toISOString() };
      users[index] = updated;
      await this.persist(users);
      return updated;
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async load(): Promise<User[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.cache = fileSchema.parse(JSON.parse(raw)).users;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Could not read ${this.filePath}, starting with an empty user registry`);
      }
      this.cache = [];
    }
    return this.cache;
  }

  private async persist(users: User[]): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify({ users }, null, 2), 'utf8');
    await rename(tmp, this.filePath);
    this.cache = users;
  }
}
