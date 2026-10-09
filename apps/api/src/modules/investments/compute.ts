import {
  INVESTMENT_CATEGORIES,
  INVESTMENT_TYPES,
  type InvestmentFlowPoint,
  type InvestmentPosition,
  type InvestmentsOverview,
  type InvestmentType,
  investmentTypeForCategory,
  type Transaction,
} from '@finance/shared';

/** Last `count` months ending at `today` (YYYY-MM-DD), oldest first. */
export function recentMonths(today: string, count: number): string[] {
  const [y, m] = today.split('-').map(Number);
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

function emptyFlows(months: string[]): InvestmentFlowPoint[] {
  return months.map((month) => ({ month, invested: 0, returned: 0, net: 0 }));
}

/**
 * Derives investment positions from the Deposit / Crypto / Stocks transactions.
 * Pure: the same transactions and date always yield the same overview.
 */
export function buildInvestmentsOverview(
  transactions: Transaction[],
  today: string,
  monthCount = 12,
): InvestmentsOverview {
  const months = recentMonths(today, monthCount);
  const index = new Map(months.map((month, i) => [month, i]));
  const positions = new Map<InvestmentType, InvestmentPosition>(
    INVESTMENT_TYPES.map((type) => [
      type,
      {
        type,
        category: INVESTMENT_CATEGORIES[type],
        invested: 0,
        returned: 0,
        net: 0,
        transactionCount: 0,
        firstDate: null,
        lastDate: null,
        monthly: emptyFlows(months),
      },
    ]),
  );
  const combined = emptyFlows(months);

  for (const t of transactions) {
    const type = investmentTypeForCategory(t.category);
    if (!type) continue;
    const position = positions.get(type);
    if (!position) continue;
    const field = t.type === 'EXPENSE' ? 'invested' : 'returned';
    position[field] += t.amount;
    position.transactionCount += 1;
    if (!position.firstDate || t.date < position.firstDate) position.firstDate = t.date;
    if (!position.lastDate || t.date > position.lastDate) position.lastDate = t.date;
    const slot = index.get(t.date.slice(0, 7));
    if (slot !== undefined) {
      const own = position.monthly[slot];
      const all = combined[slot];
      if (own) own[field] += t.amount;
      if (all) all[field] += t.amount;
    }
  }

  const finish = (p: InvestmentFlowPoint) => {
    p.net = p.returned - p.invested;
  };
  const list = INVESTMENT_TYPES.map((type) => positions.get(type)).filter(
    (p): p is InvestmentPosition => p !== undefined,
  );
  for (const p of list) {
    p.net = p.returned - p.invested;
    p.monthly.forEach(finish);
  }
  combined.forEach(finish);

  const invested = list.reduce((s, p) => s + p.invested, 0);
  const returned = list.reduce((s, p) => s + p.returned, 0);
  return {
    positions: list,
    summary: {
      invested,
      returned,
      net: returned - invested,
      transactionCount: list.reduce((s, p) => s + p.transactionCount, 0),
      activeTypes: list.filter((p) => p.transactionCount > 0).length,
    },
    monthly: combined,
  };
}
