import type { ExpenseKind } from './category';
import type { RecurringOccurrence } from './recurring';

export const ANALYTICS_PERIODS = ['month', 'last-month', '3m', '6m', '12m', 'all'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export interface DateRange {
  from: string;
  to: string;
}

export interface MoneyPeriodSummary {
  from: string;
  to: string;
  income: number;
  expenses: number;
  savings: number;
  /** Savings as a percentage of income (0 when there is no income). */
  savingsRate: number;
  transactionCount: number;
}

export type InsightTone = 'positive' | 'neutral' | 'warning';

export type InsightId =
  | 'expense-change-up'
  | 'expense-change-down'
  | 'top-category'
  | 'daily'
  | 'savings-rate'
  | 'projection-positive'
  | 'projection-negative';

/** Localisable insight: clients render `id` + `params`; `message` is the English fallback. */
export interface Insight {
  id: InsightId;
  message: string;
  tone: InsightTone;
  params: Record<string, string | number>;
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percent: number;
  count: number;
  kind: ExpenseKind | null;
}

export interface CategoryBreakdown {
  from: string;
  to: string;
  type: 'INCOME' | 'EXPENSE';
  total: number;
  items: CategoryBreakdownItem[];
}

export interface AnalyticsOverview {
  period: AnalyticsPeriod;
  summary: MoneyPeriodSummary;
  /** Same-length period immediately before `summary`. */
  previous: MoneyPeriodSummary;
  expenseChangePercent: number | null;
  incomeChangePercent: number | null;
  averageDailySpending: number;
  /** Only for the current month: savings extrapolated to month end. */
  projectedMonthlySavings: number | null;
  /** All-time balance (income minus expenses over every row). */
  totalBalance: number;
  balanceByPaymentMethod: Record<string, number>;
  topExpenseCategories: CategoryBreakdownItem[];
  topIncomeCategories: CategoryBreakdownItem[];
  insights: Insight[];
}

export interface MonthlyCashFlowPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface FixedVariableBreakdown {
  from: string;
  to: string;
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
  total: number;
}

/** Dashboard planning: what is due this month, what is safe to invest, and when. */
export interface VariableBudgetLine {
  /** One of the living-cost groups (Family, Food, Shopping, Transport) or "Other" for everything else. */
  category: string;
  /** Monthly budget: the 6-month average of past spending in this group. */
  budget: number;
  spent: number;
  remaining: number;
}

export type PlanReason = 'free-now' | 'after-income';

export interface PlanRecommendation {
  date: string;
  amount: number;
  reason: PlanReason;
  /** Name of the expected income that unlocks this tranche (after-income only). */
  incomeName: string | null;
  /** English fallback text. */
  message: string;
}

export type PlanWarningCode = 'negative-balance' | 'no-history' | 'overdue';

export interface PlanWarning {
  code: PlanWarningCode;
  params: Record<string, string | number>;
  message: string;
}

export interface MonthPlan {
  month: string;
  today: string;
  daysRemaining: number;
  recurringIncome: {
    total: number;
    received: number;
    upcoming: number;
    items: RecurringOccurrence[];
  };
  /** All-time balance (income minus expenses) at the time of the plan; the default for `cashOnHand`. */
  currentBalance: number;
  /** Money available now: the `cash` query value, else the current balance. */
  cashOnHand: number;
  cashIsDefault: boolean;
  fixed: {
    due: RecurringOccurrence[];
    paid: RecurringOccurrence[];
    dueTotal: number;
    paidTotal: number;
  };
  variable: {
    basis: '6-month-average' | 'none';
    /** Past months (within the last 6) that had living-cost spending; the average divides by this. */
    monthsOfHistory: number;
    budget: number;
    spent: number;
    remaining: number;
    lines: VariableBudgetLine[];
  };
  buffer: number;
  projection: { date: string; balance: number }[];
  floor: { date: string; balance: number } | null;
  annualRatePercent: number;
  investableNow: number;
  recommendations: PlanRecommendation[];
  expectedProfit: { monthly: number; yearly: number };
  warnings: PlanWarning[];
}
