import { z } from 'zod';
import {
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  isoTimeSchema,
  moneyAmountSchema,
  paginationQuerySchema,
} from './common';

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);

export const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export const TRANSACTION_SORT = ['newest', 'oldest'] as const;
export type TransactionSort = (typeof TRANSACTION_SORT)[number];

/**
 * Normalised transaction. `amount` is ALWAYS positive; the sign lives in `type`.
 * The spreadsheet adapter converts to/from the legacy signed representation.
 */
export const transactionSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(200),
  amount: moneyAmountSchema,
  type: transactionTypeSchema,
  paymentMethod: paymentMethodSchema,
  date: isoDateSchema,
  time: isoTimeSchema.nullable(),
  category: z.string().trim().min(1).max(100),
  note: z.string().trim().max(1000).nullable(),
  isRecurring: z.boolean(),
  recurringRuleId: idSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  userId: idSchema,
});
export type Transaction = z.infer<typeof transactionSchema>;

export const createTransactionSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  amount: moneyAmountSchema,
  type: transactionTypeSchema,
  paymentMethod: paymentMethodSchema,
  date: isoDateSchema,
  time: isoTimeSchema.nullable().optional(),
  category: z.string().trim().min(1, 'Category is required').max(100),
  note: z.string().trim().max(1000).nullable().optional(),
  isRecurring: z.boolean().optional(),
  recurringRuleId: idSchema.nullable().optional(),
  /** Client-generated idempotency key so retried requests never create duplicates. */
  clientId: z.string().trim().min(8).max(64).optional(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = createTransactionSchema.omit({ clientId: true }).partial();
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const transactionQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  type: transactionTypeSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  sort: z.enum(TRANSACTION_SORT).default('newest'),
});
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

export interface TransactionFacetCategory {
  name: string;
  count: number;
  /** Type most rows with this category have. */
  type: TransactionType;
}

export interface TransactionFacets {
  total: number;
  minDate: string | null;
  maxDate: string | null;
  categories: TransactionFacetCategory[];
  paymentMethods: { method: PaymentMethod; count: number }[];
}

/** Multi-select actions on the Transactions screen. Ids that no longer exist are skipped, not errors. */
const bulkIdsSchema = z.array(idSchema).min(1).max(500);
export const bulkTransactionActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delete'), ids: bulkIdsSchema }),
  z.object({
    action: z.literal('setCategory'),
    ids: bulkIdsSchema,
    category: z.string().trim().min(1, 'Category is required').max(100),
  }),
  z.object({ action: z.literal('setType'), ids: bulkIdsSchema, type: transactionTypeSchema }),
]);
export type BulkTransactionAction = z.infer<typeof bulkTransactionActionSchema>;

export interface BulkTransactionResult {
  /** Transactions actually changed or deleted. */
  affected: number;
  /** Ids that were not found (already deleted elsewhere). */
  missing: number;
}
