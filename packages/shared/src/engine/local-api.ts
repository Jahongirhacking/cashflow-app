import { z } from 'zod';
import {
  ANALYTICS_PERIODS,
  bulkTransactionActionSchema,
  connectSpreadsheetSchema,
  createCategorySchema,
  createRecurringRuleSchema,
  createTransactionSchema,
  currentMonthKey,
  type CurrentUser,
  markOccurrenceSchema,
  transactionQuerySchema,
  updateCategorySchema,
  updateRecurringRuleSchema,
  updateTransactionSchema,
  type User,
} from '../core';
import { AnalyticsService } from './analytics/analytics.service';
import { CategoriesRepository } from './categories/categories.repository';
import { CategoriesService } from './categories/categories.service';
import { AppError } from './errors/app-error';
import type { SheetsClient } from './google-sheets/sheets-client';
import { InvestmentsService } from './investments/investments.service';
import { type Logger, noopLogger } from './logger';
import { PlanningService } from './planning/planning.service';
import { RecurringRepository } from './recurring/recurring.repository';
import { RecurringService } from './recurring/recurring.service';
import {
  type SpreadsheetEngineConfig,
  SpreadsheetService,
  type UsersPort,
} from './spreadsheets/spreadsheet.service';
import { TransactionsRepository } from './transactions/transactions.repository';
import { TransactionsService } from './transactions/transactions.service';

export type LocalMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type LocalQuery = Record<string, string | number | boolean | null | undefined>;

export interface LocalRequest {
  method: LocalMethod;
  /** Path as the HTTP API would receive it, e.g. "/transactions/txn_1" (query string stripped). */
  path: string;
  query?: LocalQuery;
  body?: unknown;
}

/** Who is signed in on this device, and where the connection is persisted. */
export interface LocalUserStore extends UsersPort {
  /** Null when nobody is signed in. */
  current(): Promise<User | null>;
  signOut(): Promise<void>;
}

export interface LocalApiOptions {
  client: SheetsClient;
  users: LocalUserStore;
  config?: Partial<SpreadsheetEngineConfig>;
  logger?: Logger;
}

const periodSchema = z.object({ period: z.enum(ANALYTICS_PERIODS).default('month') });
const monthsSchema = z.object({ months: z.coerce.number().int().min(1).max(36).default(6) });
const categoriesQuerySchema = periodSchema.extend({
  type: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
});
const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});
const planQuerySchema = monthQuerySchema.extend({
  cash: z.coerce.number().min(0).max(1e13).optional(),
  rate: z.coerce.number().min(0).max(200).default(20),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw AppError.validation(
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

function compact(query: LocalQuery | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') out[key] = String(value);
  }
  return out;
}

export function toCurrentUser(user: User): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    spreadsheetId: user.spreadsheetId,
    spreadsheetName: user.spreadsheetName,
    spreadsheetVerifiedAt: user.spreadsheetVerifiedAt,
    hasSpreadsheet: Boolean(user.spreadsheetId),
  };
}

/**
 * The whole HTTP API, served in-process: the same paths, query parameters, bodies, validation and
 * responses as the NestJS controllers, but executed against a SheetsClient on this device. The app's
 * screens keep calling `/transactions`, `/analytics/overview`… and never know there is no server.
 * Import/export (xlsx) are not available here; they answer CONFIGURATION_ERROR.
 */
export class LocalApi {
  readonly spreadsheets: SpreadsheetService;
  readonly transactions: TransactionsService;
  readonly categories: CategoriesService;
  readonly recurring: RecurringService;
  readonly analytics: AnalyticsService;
  readonly planning: PlanningService;
  readonly investments: InvestmentsService;

  constructor(private readonly options: LocalApiOptions) {
    const { client, users } = options;
    const logger = options.logger ?? noopLogger;
    this.spreadsheets = new SpreadsheetService(client, users, {
      canAccessSheets: true,
      serviceAccountEmail: null,
      ...options.config,
    });
    const transactionsRepo = new TransactionsRepository(client);
    const categoriesRepo = new CategoriesRepository(client);
    this.transactions = new TransactionsService(this.spreadsheets, transactionsRepo);
    this.categories = new CategoriesService(this.spreadsheets, categoriesRepo);
    this.recurring = new RecurringService(
      this.spreadsheets,
      new RecurringRepository(client),
      this.transactions,
      client,
    );
    this.analytics = new AnalyticsService(this.spreadsheets, this.transactions, categoriesRepo);
    this.planning = new PlanningService(this.analytics, this.recurring);
    this.investments = new InvestmentsService(this.transactions);
    logger.log('Local API ready (device talks to Google Sheets directly)');
  }

  async request<T = unknown>(req: LocalRequest): Promise<T> {
    const segments = req.path.replace(/^\/+|\/+$/g, '').split('/');
    const [root, second, third] = segments;
    const q = compact(req.query);
    const m = req.method;

    if (root === 'health' && m === 'GET') {
      return { status: 'ok', service: 'my-cashify-local' } as T;
    }
    if (root === 'auth') {
      if (second === 'me' && m === 'GET') return toCurrentUser(await this.requireUser()) as T;
      if (second === 'logout' && m === 'POST') {
        await this.options.users.signOut();
        return undefined as T;
      }
      throw new AppError('NOT_FOUND', `Route ${m} ${req.path} is not available offline.`);
    }

    const user = await this.requireUser();

    if (root === 'spreadsheets') {
      if (second === 'status' && m === 'GET') return this.spreadsheets.status(user) as T;
      if ((second === 'connect' || second === 'reconnect') && m === 'POST') {
        const body = parse(connectSpreadsheetSchema, req.body);
        return (await this.spreadsheets.connect(user, body.spreadsheetUrl)) as T;
      }
      if (second === 'verify' && m === 'POST') return (await this.spreadsheets.verify(user)) as T;
      if (second === 'info' && m === 'GET') return (await this.spreadsheets.info(user)) as T;
    }

    if (root === 'transactions') {
      if (second === 'import' || second === 'export') {
        throw new AppError(
          'CONFIGURATION_ERROR',
          'Import and export of .xlsx files are not available in the offline app yet.',
        );
      }
      if (!second && m === 'GET') {
        return (await this.transactions.list(user, parse(transactionQuerySchema, q))) as T;
      }
      if (!second && m === 'POST') {
        return (await this.transactions.create(
          user,
          parse(createTransactionSchema, req.body),
        )) as T;
      }
      if (second === 'bulk' && m === 'POST') {
        return (await this.transactions.bulk(
          user,
          parse(bulkTransactionActionSchema, req.body),
        )) as T;
      }
      if (second === 'facets' && m === 'GET') return (await this.transactions.facets(user)) as T;
      if (second && !third) {
        if (m === 'GET') return (await this.transactions.getById(user, second)) as T;
        if (m === 'PATCH') {
          return (await this.transactions.update(
            user,
            second,
            parse(updateTransactionSchema, req.body),
          )) as T;
        }
        if (m === 'DELETE') {
          await this.transactions.remove(user, second);
          return undefined as T;
        }
      }
    }

    if (root === 'categories') {
      if (!second && m === 'GET') return (await this.categories.list(user)) as T;
      if (!second && m === 'POST') {
        return (await this.categories.create(user, parse(createCategorySchema, req.body))) as T;
      }
      if (second && m === 'PATCH') {
        return (await this.categories.update(
          user,
          second,
          parse(updateCategorySchema, req.body),
        )) as T;
      }
      if (second && m === 'DELETE') {
        await this.categories.remove(user, second);
        return undefined as T;
      }
    }

    if (root === 'recurring') {
      if (!second && m === 'GET') return (await this.recurring.list(user)) as T;
      if (second === 'schedule' && m === 'GET') {
        const { month } = parse(monthQuerySchema, q);
        return (await this.recurring.schedule(user, month ?? currentMonthKey())) as T;
      }
      if (!second && m === 'POST') {
        return (await this.recurring.create(user, parse(createRecurringRuleSchema, req.body))) as T;
      }
      if (second && third === 'done' && m === 'POST') {
        const body = parse(markOccurrenceSchema, req.body);
        return (await this.recurring.markDone(user, second, body.dueDate, body.done)) as T;
      }
      if (second && !third && m === 'PATCH') {
        return (await this.recurring.update(
          user,
          second,
          parse(updateRecurringRuleSchema, req.body),
        )) as T;
      }
      if (second && !third && m === 'DELETE') {
        await this.recurring.remove(user, second);
        return undefined as T;
      }
    }

    if (root === 'analytics' && m === 'GET') {
      if (second === 'overview') {
        return (await this.analytics.overview(user, parse(periodSchema, q).period)) as T;
      }
      if (second === 'monthly') {
        return (await this.analytics.monthly(user, parse(monthsSchema, q).months)) as T;
      }
      if (second === 'categories') {
        const { period, type } = parse(categoriesQuerySchema, q);
        return (await this.analytics.categoriesBreakdown(user, period, type)) as T;
      }
      if (second === 'fixed-variable') {
        return (await this.analytics.fixedVariable(user, parse(periodSchema, q).period)) as T;
      }
      if (second === 'trend') {
        return (await this.analytics.trend(user, parse(periodSchema, q).period)) as T;
      }
    }

    if (root === 'planning' && second === 'month' && m === 'GET') {
      const { month, cash, rate } = parse(planQuerySchema, q);
      return (await this.planning.monthPlan(
        user,
        month ?? currentMonthKey(),
        cash ?? null,
        rate,
      )) as T;
    }

    if (root === 'investments' && !second && m === 'GET') {
      return (await this.investments.overview(user)) as T;
    }

    throw new AppError('NOT_FOUND', `Route ${m} ${req.path} is not available offline.`);
  }

  private async requireUser(): Promise<User> {
    const user = await this.options.users.current();
    if (!user) throw AppError.unauthorized();
    return user;
  }
}
