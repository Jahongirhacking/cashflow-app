import { z } from 'zod';
import { idSchema, isoDateSchema, isoDateTimeSchema } from './common';

export const INVESTMENT_TYPES = [
  'DEPOSIT',
  'STOCK',
  'CRYPTO',
  'GOLD',
  'BUSINESS',
  'OTHER',
] as const;
export type InvestmentType = (typeof INVESTMENT_TYPES)[number];
export const investmentTypeSchema = z.enum(INVESTMENT_TYPES);

export const INVESTMENT_STATUSES = ['ACTIVE', 'CLOSED'] as const;
export type InvestmentStatus = (typeof INVESTMENT_STATUSES)[number];
export const investmentStatusSchema = z.enum(INVESTMENT_STATUSES);

const nonNegativeMoney = z.number('Amount must be a number').finite().min(0);

export const investmentSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(200),
  type: investmentTypeSchema,
  investedAmount: nonNegativeMoney,
  currentValue: nonNegativeMoney,
  startDate: isoDateSchema,
  /** Expected annual return in percent, e.g. 22 for 22 %. */
  expectedRate: z.number().finite().nullable(),
  /** currentValue - investedAmount, computed by the server. */
  actualProfit: z.number().finite(),
  /** actualProfit / investedAmount * 100, computed by the server (0 when nothing invested). */
  returnPercent: z.number().finite(),
  status: investmentStatusSchema,
  note: z.string().trim().max(1000).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  userId: idSchema,
});
export type Investment = z.infer<typeof investmentSchema>;

export const createInvestmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  type: investmentTypeSchema,
  investedAmount: nonNegativeMoney,
  currentValue: nonNegativeMoney,
  startDate: isoDateSchema,
  expectedRate: z.number().finite().nullable().optional(),
  status: investmentStatusSchema.default('ACTIVE'),
  note: z.string().trim().max(1000).nullable().optional(),
});
export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;

export const updateInvestmentSchema = createInvestmentSchema.partial();
export type UpdateInvestmentInput = z.infer<typeof updateInvestmentSchema>;

export interface InvestmentSummary {
  totalInvested: number;
  currentValue: number;
  totalProfit: number;
  totalReturnPercent: number;
  count: number;
}

export function computeInvestmentReturn(investedAmount: number, currentValue: number) {
  const profit = currentValue - investedAmount;
  const returnPercent = investedAmount > 0 ? (profit / investedAmount) * 100 : 0;
  return { profit, returnPercent };
}
