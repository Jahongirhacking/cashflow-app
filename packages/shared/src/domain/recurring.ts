import { z } from 'zod';
import { idSchema, isoDateSchema, isoDateTimeSchema, moneyAmountSchema } from './common';
import { paymentMethodSchema, transactionTypeSchema } from './transaction';

/** ONCE = a single unavoidable payment on `startDate` (e.g. a contract instalment). */
export const RECURRING_FREQUENCIES = ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];
export const recurringFrequencySchema = z.enum(RECURRING_FREQUENCIES);

export const recurringRuleSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(200),
  amount: moneyAmountSchema,
  type: transactionTypeSchema,
  category: z.string().trim().min(1).max(100),
  paymentMethod: paymentMethodSchema,
  frequency: recurringFrequencySchema,
  /** Day of month (1-31) for MONTHLY/YEARLY, day of week (0=Sunday) for WEEKLY, null for DAILY. */
  dayOfPeriod: z.number().int().min(0).max(31).nullable(),
  /** Month (1-12) for YEARLY rules. */
  monthOfYear: z.number().int().min(1).max(12).nullable(),
  startDate: isoDateSchema,
  endDate: isoDateSchema.nullable(),
  /** Computed by the server from the rule and today's date. */
  nextDate: isoDateSchema.nullable(),
  isActive: z.boolean(),
  note: z.string().trim().max(1000).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  userId: idSchema,
});
export type RecurringRule = z.infer<typeof recurringRuleSchema>;

export const createRecurringRuleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  amount: moneyAmountSchema,
  type: transactionTypeSchema.default('EXPENSE'),
  category: z.string().trim().min(1, 'Category is required').max(100),
  paymentMethod: paymentMethodSchema.default('CARD'),
  frequency: recurringFrequencySchema,
  dayOfPeriod: z.number().int().min(0).max(31).nullable().optional(),
  monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
  startDate: isoDateSchema,
  endDate: isoDateSchema.nullable().optional(),
  isActive: z.boolean().default(true),
  note: z.string().trim().max(1000).nullable().optional(),
});
export type CreateRecurringRuleInput = z.infer<typeof createRecurringRuleSchema>;

export const updateRecurringRuleSchema = createRecurringRuleSchema.partial();
export type UpdateRecurringRuleInput = z.infer<typeof updateRecurringRuleSchema>;

export const OCCURRENCE_STATUSES = ['paid', 'due', 'overdue', 'received', 'expected'] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

/** One dated instance of a rule inside a month, with its payment state. */
export interface RecurringOccurrence {
  ruleId: string;
  name: string;
  amount: number;
  type: TransactionTypeValue;
  category: string;
  paymentMethod: PaymentMethodValue;
  frequency: RecurringFrequency;
  dueDate: string;
  status: OccurrenceStatus;
  /** Transaction that settled this occurrence, when found. */
  transactionId: string | null;
  /** True when the settling transaction was matched by name rather than by rule id. */
  matchedByName: boolean;
  /** True when the user ticked this occurrence off as a reminder (no transaction involved). */
  markedDone: boolean;
}

export interface RecurringSchedule {
  month: string;
  today: string;
  occurrences: RecurringOccurrence[];
  totals: {
    expenseDue: number;
    expensePaid: number;
    incomeExpected: number;
    incomeReceived: number;
  };
}

/** Reminder tick for one occurrence; it never touches transactions. */
export const markOccurrenceSchema = z.object({
  dueDate: isoDateSchema,
  done: z.boolean(),
});
export type MarkOccurrenceInput = z.infer<typeof markOccurrenceSchema>;

type TransactionTypeValue = z.infer<typeof transactionTypeSchema>;
type PaymentMethodValue = z.infer<typeof paymentMethodSchema>;
