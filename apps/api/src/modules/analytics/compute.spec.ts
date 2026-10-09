import type { Category, Transaction } from '@finance/shared';
import {
  buildInsights,
  categoryBreakdown,
  createClassifier,
  detectRepeatingNames,
  fixedVariable,
  monthlyCashFlow,
  projectMonthlySavings,
  spendingTrend,
  summarise,
} from './compute';

let n = 0;
function tx(p: Partial<Transaction>): Transaction {
  n += 1;
  return {
    id: `txn_${n}`,
    name: 'x',
    amount: 1,
    type: 'EXPENSE',
    paymentMethod: 'CARD',
    date: '2026-10-01',
    time: null,
    category: 'Other',
    note: null,
    isRecurring: false,
    recurringRuleId: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    userId: 'u',
    ...p,
  };
}

const data: Transaction[] = [
  tx({ name: 'Oylik', type: 'INCOME', amount: 10_000_000, date: '2026-09-05', category: 'Oylik' }),
  tx({ name: 'Kia kredit', amount: 3_000_000, date: '2026-09-18', category: 'Kredit' }),
  tx({ name: 'Ovqat', amount: 1_000_000, date: '2026-09-12', category: 'Ovqat' }),
  tx({ name: 'Claude', amount: 670_000, date: '2026-09-03', category: 'Obuna' }),
  tx({ name: 'Oylik', type: 'INCOME', amount: 10_000_000, date: '2026-10-05', category: 'Oylik' }),
  tx({ name: 'Kia kredit', amount: 3_000_000, date: '2026-10-18', category: 'Kredit' }),
  tx({ name: 'Claude', amount: 670_000, date: '2026-10-03', category: 'Obuna' }),
  tx({ name: 'Bozor', amount: 500_000, date: '2026-10-06', category: 'Ovqat' }),
  tx({ name: 'Taksi', amount: 300_000, date: '2026-10-06', category: 'Transport' }),
];

describe('analytics compute', () => {
  it('summarises a period with savings rate', () => {
    const s = summarise(data, '2026-10-01', '2026-10-31');
    expect(s).toMatchObject({
      income: 10_000_000,
      expenses: 4_470_000,
      savings: 5_530_000,
      transactionCount: 5,
    });
    expect(s.savingsRate).toBeCloseTo(55.3, 1);
  });

  it('builds monthly cash flow with empty months', () => {
    const points = monthlyCashFlow(data, 3, '2026-10');
    expect(points.map((p) => p.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(points[0]).toEqual({ month: '2026-08', income: 0, expenses: 0, net: 0 });
    expect(points[2]?.net).toBe(5_530_000);
  });

  it('breaks down categories case-insensitively with percentages', () => {
    const b = categoryBreakdown(data, 'EXPENSE', '2026-10-01', '2026-10-31', () => 'VARIABLE');
    expect(b.items[0]).toMatchObject({ category: 'Kredit', amount: 3_000_000 });
    expect(b.items.reduce((s, i) => s + i.percent, 0)).toBeCloseTo(100, 5);
  });

  it('classifies fixed vs variable with overrides, keywords, rules and repetition', () => {
    const categories: Category[] = [
      {
        id: 'c1',
        name: 'Transport',
        type: 'EXPENSE',
        kind: 'FIXED',
        icon: null,
        color: null,
        isDefault: true,
        createdAt: '',
        updatedAt: '',
        userId: 'u',
      },
    ];
    const classify = createClassifier(categories, data, '2026-10-20');
    expect(classify(tx({ name: 'Kia kredit', category: 'Kredit' }))).toBe('FIXED'); // keyword
    expect(classify(tx({ name: 'Taksi', category: 'Transport' }))).toBe('FIXED'); // override
    expect(classify(tx({ name: 'Claude', category: 'Obuna' }))).toBe('FIXED'); // keyword + repetition
    expect(classify(tx({ name: 'Bozor', category: 'Ovqat' }))).toBe('VARIABLE');
    expect(classify(tx({ name: 'Anything', category: 'Food', recurringRuleId: 'rec_1' }))).toBe(
      'FIXED',
    );
    expect(detectRepeatingNames(data, '2026-10-20')).toEqual(new Set(['kia kredit', 'claude']));

    const fv = fixedVariable(data, '2026-10-01', '2026-10-31', classify);
    expect(fv.fixed).toBe(3_970_000);
    expect(fv.variable).toBe(500_000);
    expect(fv.fixedPercent).toBeCloseTo(88.8, 1);
  });

  it('computes the daily trend up to today', () => {
    const trend = spendingTrend(data, '2026-10-01', '2026-10-31', '2026-10-07');
    expect(trend.points).toHaveLength(7);
    expect(trend.points[5]?.amount).toBe(800_000);
    expect(trend.total).toBe(4_470_000);
    expect(trend.averageDaily).toBeCloseTo(4_470_000 / 7, 3);
  });

  it('projects savings and writes insights only with enough data', () => {
    const summary = summarise(data, '2026-10-01', '2026-10-31');
    const projected = projectMonthlySavings(summary, '2026-10-10');
    expect(projected).toBeCloseTo(10_000_000 - (4_470_000 / 10) * 31, 0);
    const insights = buildInsights({
      summary,
      previous: summarise(data, '2026-09-01', '2026-09-30'),
      expenseChangePercent: -4.3,
      averageDailySpending: 447_000,
      projectedMonthlySavings: projected,
      topExpense: categoryBreakdown(data, 'EXPENSE', '2026-10-01', '2026-10-31', () => 'FIXED')
        .items[0],
      isCurrentMonth: true,
    });
    expect(insights.map((i) => i.id)).toEqual([
      'expense-change-down',
      'top-category',
      'daily',
      'savings-rate',
      'projection-negative',
    ]);
    expect(insights[0]?.params).toEqual({ percent: 4 });
    expect(insights[0]?.message).toBe(
      'Your expenses decreased 4% compared with the previous period.',
    );
    expect(
      buildInsights({
        summary: summarise([], '2026-10-01', '2026-10-31'),
        previous: summarise([], '2026-09-01', '2026-09-30'),
        expenseChangePercent: null,
        averageDailySpending: 0,
        projectedMonthlySavings: null,
        topExpense: undefined,
        isCurrentMonth: true,
      }),
    ).toEqual([]);
  });
});
