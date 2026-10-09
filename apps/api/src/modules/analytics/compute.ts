import {
  addDays,
  type Category,
  type CategoryBreakdown,
  type CategoryBreakdownItem,
  type ExpenseKind,
  type Insight,
  type MoneyPeriodSummary,
  type MonthlyCashFlowPoint,
  type SpendingTrend,
  type Transaction,
  daysInMonth,
  diffDays,
  shiftMonthKey,
  type FixedVariableBreakdown,
} from '@finance/shared';

/** Pure analytics over the normalised transaction list. Everything here is unit-testable. */

export function inRange(t: Transaction, from: string, to: string): boolean {
  return t.date >= from && t.date <= to;
}

export function summarise(
  transactions: Transaction[],
  from: string,
  to: string,
): MoneyPeriodSummary {
  let income = 0;
  let expenses = 0;
  let count = 0;
  for (const t of transactions) {
    if (!inRange(t, from, to)) continue;
    count += 1;
    if (t.type === 'INCOME') income += t.amount;
    else expenses += t.amount;
  }
  const savings = income - expenses;
  return {
    from,
    to,
    income,
    expenses,
    savings,
    savingsRate: income > 0 ? (savings / income) * 100 : 0,
    transactionCount: count,
  };
}

export function monthRange(monthKey: string): { from: string; to: string } {
  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-${String(daysInMonth(monthKey)).padStart(2, '0')}`,
  };
}

export function monthlyCashFlow(
  transactions: Transaction[],
  months: number,
  endMonth: string,
): MonthlyCashFlowPoint[] {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i -= 1) keys.push(shiftMonthKey(endMonth, -i));
  const byMonth = new Map(keys.map((k) => [k, { month: k, income: 0, expenses: 0, net: 0 }]));
  for (const t of transactions) {
    const point = byMonth.get(t.date.slice(0, 7));
    if (!point) continue;
    if (t.type === 'INCOME') point.income += t.amount;
    else point.expenses += t.amount;
  }
  return keys.map((k) => {
    const p = byMonth.get(k) as MonthlyCashFlowPoint;
    return { ...p, net: p.income - p.expenses };
  });
}

export type KindClassifier = (t: Transaction) => ExpenseKind;

export function categoryBreakdown(
  transactions: Transaction[],
  type: 'INCOME' | 'EXPENSE',
  from: string,
  to: string,
  classify: KindClassifier,
): CategoryBreakdown {
  const map = new Map<string, CategoryBreakdownItem>();
  let total = 0;
  for (const t of transactions) {
    if (t.type !== type || !inRange(t, from, to)) continue;
    const key = t.category.trim().toLowerCase();
    const item = map.get(key) ?? {
      category: t.category.trim(),
      amount: 0,
      percent: 0,
      count: 0,
      kind: type === 'EXPENSE' ? classify(t) : null,
    };
    item.amount += t.amount;
    item.count += 1;
    map.set(key, item);
    total += t.amount;
  }
  const items = [...map.values()]
    .map((i) => ({ ...i, percent: total > 0 ? (i.amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
  return { from, to, type, total, items };
}

export function fixedVariable(
  transactions: Transaction[],
  from: string,
  to: string,
  classify: KindClassifier,
): FixedVariableBreakdown {
  const breakdown = categoryBreakdown(transactions, 'EXPENSE', from, to, classify);
  let fixed = 0;
  let variable = 0;
  for (const t of transactions) {
    if (t.type !== 'EXPENSE' || !inRange(t, from, to)) continue;
    if (classify(t) === 'FIXED') fixed += t.amount;
    else variable += t.amount;
  }
  const total = fixed + variable;
  return {
    from,
    to,
    fixed,
    variable,
    fixedPercent: total > 0 ? (fixed / total) * 100 : 0,
    variablePercent: total > 0 ? (variable / total) * 100 : 0,
    items: breakdown.items,
  };
}

/** Daily expense totals; `averageDaily` divides by the elapsed days (capped at `today`). */
export function spendingTrend(
  transactions: Transaction[],
  from: string,
  to: string,
  today: string,
): SpendingTrend {
  const end = to < today ? to : today;
  const points: SpendingTrend['points'] = [];
  const byDate = new Map<string, number>();
  let total = 0;
  for (const t of transactions) {
    if (t.type !== 'EXPENSE' || !inRange(t, from, to)) continue;
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amount);
    total += t.amount;
  }
  if (from <= end) {
    for (let d = from; d <= end; d = addDays(d, 1))
      points.push({ date: d, amount: byDate.get(d) ?? 0 });
  }
  const elapsed = Math.max(1, points.length);
  return { from, to, points, averageDaily: total / elapsed, total };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

const FIXED_KEYWORDS =
  /kredit|credit|loan|qarz|ipoteka|mortgage|rent|ijara|arenda|obuna|subscri|kommunal|utilit|internet|contract|shartnoma|insurance|sug.?urta|tuition|school|maktab|kindergarten|bog.?cha/i;

/**
 * Deterministic fixed/variable classifier:
 *  1. transactions linked to a recurring rule are fixed
 *  2. the category's kind from the Categories sheet (user override) wins
 *  3. keyword rules on category/name
 *  4. names that repeat with a similar amount in 2+ of the last 3 months
 */
export function createClassifier(
  categories: Category[],
  transactions: Transaction[],
  today: string,
): KindClassifier {
  const kindByCategory = new Map<string, ExpenseKind>();
  for (const c of categories)
    if (c.type === 'EXPENSE' && c.kind) kindByCategory.set(c.name.toLowerCase(), c.kind);
  const repeating = detectRepeatingNames(transactions, today);
  return (t) => {
    if (t.recurringRuleId) return 'FIXED';
    const override = kindByCategory.get(t.category.trim().toLowerCase());
    if (override) return override;
    if (FIXED_KEYWORDS.test(t.category) || FIXED_KEYWORDS.test(t.name)) return 'FIXED';
    if (repeating.has(normaliseName(t.name))) return 'FIXED';
    return 'VARIABLE';
  };
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Expense names that appear with an amount within ±10% in at least two of the last three months. */
export function detectRepeatingNames(transactions: Transaction[], today: string): Set<string> {
  const month = today.slice(0, 7);
  const window = new Set([month, shiftMonthKey(month, -1), shiftMonthKey(month, -2)]);
  const byName = new Map<string, Map<string, number[]>>();
  for (const t of transactions) {
    if (t.type !== 'EXPENSE') continue;
    const m = t.date.slice(0, 7);
    if (!window.has(m)) continue;
    const name = normaliseName(t.name);
    const months = byName.get(name) ?? new Map<string, number[]>();
    months.set(m, [...(months.get(m) ?? []), t.amount]);
    byName.set(name, months);
  }
  const result = new Set<string>();
  for (const [name, months] of byName) {
    if (months.size < 2) continue;
    const amounts = [...months.values()].map((list) => Math.max(...list));
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    if (min > 0 && (max - min) / max <= 0.1) result.add(name);
  }
  return result;
}

export interface InsightInput {
  summary: MoneyPeriodSummary;
  previous: MoneyPeriodSummary;
  expenseChangePercent: number | null;
  averageDailySpending: number;
  projectedMonthlySavings: number | null;
  topExpense: CategoryBreakdownItem | undefined;
  isCurrentMonth: boolean;
}

function money(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} so'm`;
}

/** Deterministic, data-backed insights. Nothing is produced when the data is too thin. */
export function buildInsights(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const { summary, previous, expenseChangePercent, topExpense } = input;
  if (summary.transactionCount === 0) return out;
  if (
    expenseChangePercent !== null &&
    previous.transactionCount >= 3 &&
    Math.abs(expenseChangePercent) >= 1
  ) {
    const up = expenseChangePercent > 0;
    const percent = Math.abs(Math.round(expenseChangePercent));
    out.push({
      id: up ? 'expense-change-up' : 'expense-change-down',
      tone: up ? 'warning' : 'positive',
      params: { percent },
      message: `Your expenses ${up ? 'increased' : 'decreased'} ${percent}% compared with the previous period.`,
    });
  }
  if (topExpense && summary.expenses > 0 && topExpense.percent >= 25) {
    const percent = Math.round(topExpense.percent);
    out.push({
      id: 'top-category',
      tone: topExpense.percent >= 45 ? 'warning' : 'neutral',
      params: { category: topExpense.category, percent },
      message: `${topExpense.category} represents ${percent}% of your expenses.`,
    });
  }
  if (input.averageDailySpending > 0) {
    const amount = Math.round(input.averageDailySpending);
    out.push({
      id: 'daily',
      tone: 'neutral',
      params: { amount },
      message: `Your average daily spending is ${money(amount)}.`,
    });
  }
  if (summary.income > 0) {
    const percent = Math.round(summary.savingsRate * 10) / 10;
    out.push({
      id: 'savings-rate',
      tone:
        summary.savingsRate >= 20 ? 'positive' : summary.savingsRate < 0 ? 'warning' : 'neutral',
      params: { percent },
      message: `Your current savings rate is ${percent.toFixed(1)}%.`,
    });
  }
  if (input.isCurrentMonth && input.projectedMonthlySavings !== null && summary.income > 0) {
    const positive = input.projectedMonthlySavings >= 0;
    const amount = Math.round(Math.abs(input.projectedMonthlySavings));
    out.push({
      id: positive ? 'projection-positive' : 'projection-negative',
      tone: positive ? 'positive' : 'warning',
      params: { amount },
      message: positive
        ? `You are projected to save approximately ${compact(amount)} so'm this month.`
        : `At this pace you will overspend by about ${compact(amount)} so'm this month.`,
    });
  }
  return out;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.round(n).toString();
}

/** Savings so far in the month extrapolated to month end (income assumed already received). */
export function projectMonthlySavings(summary: MoneyPeriodSummary, today: string): number | null {
  const month = summary.from.slice(0, 7);
  if (!today.startsWith(month)) return null;
  const elapsed = Math.max(1, diffDays(summary.from, today) + 1);
  const total = daysInMonth(month);
  const projectedExpenses = (summary.expenses / elapsed) * total;
  return summary.income - projectedExpenses;
}
