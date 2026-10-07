import { z } from 'zod';

/** Calendar date in ISO `YYYY-MM-DD` form (no timezone). */
export const isoDateSchema = z.iso.date('Expected a date in YYYY-MM-DD format');

/** Wall-clock time in `HH:mm` form. */
export const isoTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time in HH:mm format');

/** Full ISO-8601 timestamp, always UTC on the wire. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** Positive money amount in the user's base currency (UZS). Stored as an integer. */
export const moneyAmountSchema = z
  .number('Amount must be a number')
  .finite()
  .positive('Amount must be greater than zero')
  .max(1_000_000_000_000, 'Amount is too large');

export const idSchema = z.string().min(1).max(64);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
