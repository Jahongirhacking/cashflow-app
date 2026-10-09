import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './common';
import { transactionTypeSchema } from './transaction';

/** Deterministic fixed/variable classification used by analytics. */
export const EXPENSE_KINDS = ['FIXED', 'VARIABLE'] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];
export const expenseKindSchema = z.enum(EXPENSE_KINDS);

export const categorySchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(100),
  type: transactionTypeSchema,
  kind: expenseKindSchema.nullable(),
  icon: z.string().trim().max(50).nullable(),
  color: z.string().trim().max(20).nullable(),
  isDefault: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  userId: idSchema,
});
export type Category = z.infer<typeof categorySchema>;

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  type: transactionTypeSchema,
  kind: expenseKindSchema.nullable().optional(),
  icon: z.string().trim().max(50).nullable().optional(),
  color: z.string().trim().max(20).nullable().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export interface DefaultCategory {
  name: string;
  type: z.infer<typeof transactionTypeSchema>;
  kind: ExpenseKind | null;
  icon: string;
}

/** Bump when defaults change; existing spreadsheets receive the missing entries on next initialisation. */
export const CATEGORY_SEED_VERSION = '3';

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: 'Salary', type: 'INCOME', kind: null, icon: 'briefcase' },
  { name: 'Deposit', type: 'INCOME', kind: null, icon: 'piggy-bank' },
  { name: 'Crypto', type: 'INCOME', kind: null, icon: 'bitcoin' },
  { name: 'Stocks', type: 'INCOME', kind: null, icon: 'trending-up' },
  { name: 'Bonus', type: 'INCOME', kind: null, icon: 'gift' },
  { name: 'Freelance', type: 'INCOME', kind: null, icon: 'laptop' },
  { name: 'Business', type: 'INCOME', kind: null, icon: 'building-2' },
  { name: 'Other Income', type: 'INCOME', kind: null, icon: 'plus-circle' },
  { name: 'Food', type: 'EXPENSE', kind: 'VARIABLE', icon: 'utensils' },
  { name: 'Transport', type: 'EXPENSE', kind: 'VARIABLE', icon: 'bus' },
  { name: 'Housing', type: 'EXPENSE', kind: 'FIXED', icon: 'home' },
  { name: 'Utilities', type: 'EXPENSE', kind: 'FIXED', icon: 'zap' },
  { name: 'Family', type: 'EXPENSE', kind: 'VARIABLE', icon: 'users' },
  { name: 'Credit', type: 'EXPENSE', kind: 'FIXED', icon: 'credit-card' },
  { name: 'Deposit', type: 'EXPENSE', kind: 'VARIABLE', icon: 'piggy-bank' },
  { name: 'Crypto', type: 'EXPENSE', kind: 'VARIABLE', icon: 'bitcoin' },
  { name: 'Stocks', type: 'EXPENSE', kind: 'VARIABLE', icon: 'trending-up' },
  { name: 'Subscription', type: 'EXPENSE', kind: 'FIXED', icon: 'repeat' },
  { name: 'Shopping', type: 'EXPENSE', kind: 'VARIABLE', icon: 'shopping-bag' },
  { name: 'Education', type: 'EXPENSE', kind: 'VARIABLE', icon: 'graduation-cap' },
  { name: 'Health', type: 'EXPENSE', kind: 'VARIABLE', icon: 'heart-pulse' },
  { name: 'Entertainment', type: 'EXPENSE', kind: 'VARIABLE', icon: 'clapperboard' },
  { name: 'Other', type: 'EXPENSE', kind: 'VARIABLE', icon: 'circle-ellipsis' },
] as const;
