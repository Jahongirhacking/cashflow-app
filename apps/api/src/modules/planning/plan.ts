import {
  addDays,
  daysInMonth,
  type MonthPlan,
  type PlanRecommendation,
  type PlanWarning,
  type RecurringOccurrence,
  shiftMonthKey,
  type Transaction,
  type VariableBudgetLine,
  isInvestmentTransaction,
} from '@finance/shared';

export interface PlanInput {
  month: string;
  today: string;
  occurrences: RecurringOccurrence[];
  transactions: Transaction[];
  /** Money available right now; null → default to the current balance of the sheet. */
  cash: number | null;
  annualRatePercent: number;
  /** Fraction of the variable budget kept untouched as a cushion (default 10%). */
  bufferRatio?: number;
}

function monthEnd(key: string): string {
  return `${key}-${String(daysInMonth(key)).padStart(2, '0')}`;
}

function normaliseCategory(c: string): string {
  return c.trim().toLowerCase();
}

/**
 * Living-cost groups shown in the plan (only those with spending appear). Anything outside these
 * groups (credit, subscriptions, investments, one-offs) is not a living cost and is left out.
 */
const LIVING_GROUPS: { name: string; match: RegExp }[] = [
  { name: 'Family', match: /family|oila/ },
  { name: 'Entertainment', match: /entertain|ko'ngil|dam olish|kino|o'yin/ },
  { name: 'Food', match: /food|ovqat|oziq/ },
  { name: 'Health', match: /health|salomat|sog'li|dori|shifo/ },
  { name: 'Housing', match: /housing|rent|ijara|\buy\b|kvartira/ },
  { name: 'Shopping', match: /shopping|xarid|bozor/ },
  { name: 'Transport', match: /transport|taksi|yo'l/ },
  { name: 'Utilities', match: /utilit|kommunal|svet|gaz|suv/ },
];
const GROUP_ORDER = LIVING_GROUPS.map((g) => g.name);
const HISTORY_MONTHS = 6;

function livingGroup(category: string): string | null {
  const key = normaliseCategory(category);
  return LIVING_GROUPS.find((g) => g.match.test(key))?.name ?? null;
}

/**
 * Living-cost spend per group in a month. Transactions written by a recurring rule are left out
 * (they are already counted as fixed payments), as is money put into Deposit / Crypto / Stocks.
 */
function livingByGroup(transactions: Transaction[], month: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'EXPENSE' || !t.date.startsWith(month) || t.recurringRuleId) continue;
    if (isInvestmentTransaction(t)) continue;
    const group = livingGroup(t.category);
    if (!group) continue;
    map.set(group, (map.get(group) ?? 0) + t.amount);
  }
  return map;
}

/**
 * Month plan: unpaid fixed expenses as a to-do list, a living-cost budget from the 6-month
 * average per group, a daily balance projection, and the largest
 * amounts that can be invested without the balance dipping below the buffer.
 */
export function buildMonthPlan(input: PlanInput): MonthPlan {
  const { month, today, occurrences, transactions, annualRatePercent } = input;
  const bufferRatio = input.bufferRatio ?? 0.1;
  const end = monthEnd(month);
  const start = today > end ? end : today < `${month}-01` ? `${month}-01` : today;
  const daysRemaining = Math.max(
    1,
    Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1,
  );

  // --- recurring income ---
  const incomeItems = occurrences.filter((o) => o.type === 'INCOME');
  const incomeTotal = incomeItems.reduce((s, o) => s + o.amount, 0);
  const incomeReceived = incomeItems
    .filter((o) => o.status === 'received')
    .reduce((s, o) => s + o.amount, 0);
  const incomeUpcoming = incomeItems.filter((o) => o.status === 'expected' && o.dueDate >= start);

  // --- fixed expenses ---
  const fixedAll = occurrences.filter((o) => o.type === 'EXPENSE');
  const due = fixedAll.filter((o) => o.status !== 'paid');
  const paid = fixedAll.filter((o) => o.status === 'paid');
  const dueTotal = due.reduce((s, o) => s + o.amount, 0);
  const paidTotal = paid.reduce((s, o) => s + o.amount, 0);

  // --- living-cost budget: 6-month average per group ---
  const history = Array.from({ length: HISTORY_MONTHS }, (_, i) =>
    livingByGroup(transactions, shiftMonthKey(month, -(i + 1))),
  ).filter((m) => m.size > 0);
  const monthsOfHistory = history.length;
  const basis: MonthPlan['variable']['basis'] = monthsOfHistory > 0 ? '6-month-average' : 'none';
  const budgetByGroup = new Map<string, number>();
  for (const m of history)
    for (const [group, amount] of m)
      budgetByGroup.set(group, (budgetByGroup.get(group) ?? 0) + amount);
  for (const [group, total] of budgetByGroup) budgetByGroup.set(group, total / monthsOfHistory);
  const spentThisMonth = livingByGroup(transactions, month);
  const lines: VariableBudgetLine[] = GROUP_ORDER.filter(
    (g) => (budgetByGroup.get(g) ?? 0) > 0 || (spentThisMonth.get(g) ?? 0) > 0,
  ).map((g) => {
    const groupBudget = Math.round(budgetByGroup.get(g) ?? 0);
    const groupSpent = spentThisMonth.get(g) ?? 0;
    return {
      category: g,
      budget: groupBudget,
      spent: groupSpent,
      remaining: Math.max(0, groupBudget - groupSpent),
    };
  });
  const budget = lines.reduce((s, l) => s + l.budget, 0);
  const spent = lines.reduce((s, l) => s + l.spent, 0);
  const remaining = lines.reduce((s, l) => s + l.remaining, 0);
  const buffer = Math.round(budget * bufferRatio);

  // --- cash and projection ---
  // What the user actually has: every income minus every expense ever recorded.
  const currentBalance = Math.round(
    transactions.reduce((s, t) => s + (t.type === 'INCOME' ? t.amount : -t.amount), 0),
  );
  const cashIsDefault = input.cash === null;
  const cashOnHand = cashIsDefault ? currentBalance : (input.cash as number);
  const burn = remaining / daysRemaining;

  const dates: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);
  const outgoingOn = (d: string) =>
    due
      .filter((o) => (o.dueDate < start ? start : o.dueDate) === d)
      .reduce((sum, o) => sum + o.amount, 0);
  const inflowOn = (d: string) =>
    incomeUpcoming.filter((o) => o.dueDate === d).reduce((sum, o) => sum + o.amount, 0);
  const project = (withInflows: boolean): number[] => {
    let balance = cashOnHand;
    return dates.map((d) => {
      balance += (withInflows ? inflowOn(d) : 0) - outgoingOn(d) - burn;
      return Math.round(balance);
    });
  };
  const balances = project(true);
  const conservative = project(false);
  const projection = dates.map((date, i) => ({ date, balance: balances[i] as number }));
  const floor = projection.reduce<{ date: string; balance: number } | null>(
    (min, p) => (min === null || p.balance < min.balance ? p : min),
    null,
  );

  // --- recommendations ---
  // Tranche 1 (today): only money that is never needed even if no further income arrives.
  // Later tranches: unlocked by each expected inflow, sized by the balance floor from that date on.
  const recommendations: PlanRecommendation[] = [];
  const roundDown = (n: number) => Math.floor(Math.max(0, n) / 1000) * 1000;
  const nowAmount = roundDown(Math.min(...conservative) - buffer);
  if (nowAmount > 0) {
    recommendations.push({
      date: start,
      amount: nowAmount,
      reason: 'free-now',
      incomeName: null,
      message: "Not needed for this month's fixed expenses or variable budget",
    });
    for (let i = 0; i < balances.length; i += 1) (balances[i] as number) -= nowAmount;
  }
  for (const inflow of [...incomeUpcoming].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
    const index = dates.indexOf(inflow.dueDate);
    if (index < 0) continue;
    const amount = roundDown(Math.min(...balances.slice(index)) - buffer);
    if (amount <= 0) continue;
    recommendations.push({
      date: inflow.dueDate,
      amount,
      reason: 'after-income',
      incomeName: inflow.name,
      message: `After ${inflow.name} arrives`,
    });
    for (let i = index; i < balances.length; i += 1) (balances[i] as number) -= amount;
  }
  const totalRecommended = recommendations.reduce((s, r) => s + r.amount, 0);
  const expectedProfit = {
    monthly: Math.round((totalRecommended * annualRatePercent) / 100 / 12),
    yearly: Math.round((totalRecommended * annualRatePercent) / 100),
  };

  const warnings: PlanWarning[] = [];
  if (floor && floor.balance < 0) {
    const amount = Math.round(floor.balance);
    warnings.push({
      code: 'negative-balance',
      params: { amount, date: floor.date },
      message: `Your balance would drop to ${amount.toLocaleString('en-US')} so'm around ${floor.date}. Cover that before investing.`,
    });
  }
  if (basis === 'none') {
    warnings.push({
      code: 'no-history',
      params: {},
      message:
        'No spending history in the last 6 months yet, so the living-cost budget is 0. Add past expenses for a better plan.',
    });
  }
  const overdue = due.filter((o) => o.status === 'overdue');
  if (overdue.length > 0) {
    warnings.push({
      code: 'overdue',
      params: { count: overdue.length },
      message: `${overdue.length} fixed ${overdue.length === 1 ? 'expense is' : 'expenses are'} overdue.`,
    });
  }

  return {
    month,
    today,
    daysRemaining,
    recurringIncome: {
      total: incomeTotal,
      received: incomeReceived,
      upcoming: incomeUpcoming.reduce((s, o) => s + o.amount, 0),
      items: incomeItems,
    },
    currentBalance,
    cashOnHand,
    cashIsDefault,
    fixed: { due, paid, dueTotal, paidTotal },
    variable: {
      basis,
      monthsOfHistory,
      budget: Math.round(budget),
      spent: Math.round(spent),
      remaining: Math.round(remaining),
      lines,
    },
    buffer,
    projection,
    floor,
    annualRatePercent,
    investableNow: nowAmount,
    recommendations,
    expectedProfit,
    warnings,
  };
}
