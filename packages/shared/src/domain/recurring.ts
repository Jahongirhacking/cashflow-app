import { z } from 'zod';
import { idSchema, isoDateSchema, isoDateTimeSchema, moneyAmountSchema } from './common';
import { paymentMethodSchema, transactionTypeSchema } from './transaction';

export const RECURRING_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
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
