import type { Transaction } from './transaction';

/**
 * Investments are not stored separately: they are derived from transactions in the
 * Deposit, Crypto and Stocks categories. An EXPENSE in one of them is money put in,
 * an INCOME is money taken out (interest, dividends, a sale, a withdrawal).
 */
export const INVESTMENT_TYPES = ['DEPOSIT', 'CRYPTO', 'STOCK'] as const;
export type InvestmentType = (typeof INVESTMENT_TYPES)[number];

/** Category name (as seeded in the Categories sheet) that feeds each investment type. */
export const INVESTMENT_CATEGORIES: Record<InvestmentType, string> = {
  DEPOSIT: 'Deposit',
  CRYPTO: 'Crypto',
  STOCK: 'Stocks',
};

const TYPE_BY_CATEGORY = new Map<string, InvestmentType>(
  (Object.entries(INVESTMENT_CATEGORIES) as [InvestmentType, string][]).map(([type, name]) => [
    name.toLowerCase(),
    type,
  ]),
);

export function investmentTypeForCategory(category: string): InvestmentType | null {
  return TYPE_BY_CATEGORY.get(category.trim().toLowerCase()) ?? null;
}

export function isInvestmentTransaction(transaction: Pick<Transaction, 'category'>): boolean {
  return investmentTypeForCategory(transaction.category) !== null;
}

/** One calendar month of flows for an investment type (or all types combined). */
export interface InvestmentFlowPoint {
  month: string;
  /** Money put in during the month (EXPENSE transactions). */
  invested: number;
  /** Money taken out during the month (INCOME transactions). */
  returned: number;
  /** returned - invested. */
  net: number;
}

export interface InvestmentPosition {
  type: InvestmentType;
  category: string;
  /** All-time money put in. */
  invested: number;
  /** All-time money taken out. */
  returned: number;
  /** returned - invested: negative while money is still at work, positive once it has paid back more than it cost. */
  net: number;
  transactionCount: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Flows for the months covered by the overview, oldest first. */
  monthly: InvestmentFlowPoint[];
}

export interface InvestmentSummary {
  invested: number;
  returned: number;
  net: number;
  transactionCount: number;
  /** Types with at least one transaction. */
  activeTypes: number;
}

export interface InvestmentsOverview {
  positions: InvestmentPosition[];
  summary: InvestmentSummary;
  /** Combined flows across all types for the covered months, oldest first. */
  monthly: InvestmentFlowPoint[];
}
