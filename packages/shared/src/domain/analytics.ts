import type { ExpenseKind } from './category';

export interface MoneyPeriodSummary {
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  transactionCount: number;
}

export type InsightTone = 'positive' | 'neutral' | 'warning';

export interface Insight {
  id: string;
  message: string;
  tone: InsightTone;
}

export interface AnalyticsOverview {
  /** Lifetime totals computed from every transaction row. */
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  savingsRate: number;
  /** YYYY-MM of the current calendar month. */
  currentMonth: string;
  current: MoneyPeriodSummary;
  previous: MoneyPeriodSummary;
  /** Percent change in expenses vs previous month, null when previous month has no expenses. */
  expenseChangePercent: number | null;
  averageDailySpending: number;
  projectedMonthlySavings: number | null;
  balanceByPaymentMethod: Record<string, number>;
  insights: Insight[];
}

export interface MonthlyCashFlowPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percent: number;
  count: number;
  kind: ExpenseKind | null;
}

export interface CategoryBreakdown {
  month: string | null;
  total: number;
  items: CategoryBreakdownItem[];
}

export interface FixedVariableBreakdown {
  month: string | null;
  fixed: number;
  variable: number;
  fixedPercent: number;
  variablePercent: number;
  items: CategoryBreakdownItem[];
}

export interface DailySpendingPoint {
  date: string;
  amount: number;
}

export interface SpendingTrend {
  from: string;
  to: string;
  points: DailySpendingPoint[];
  averageDaily: number;
}
