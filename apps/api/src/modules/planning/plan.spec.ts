import type { RecurringOccurrence, Transaction } from '@finance/shared';
import { buildMonthPlan } from './plan';

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
    createdAt: '',
    updatedAt: '',
    userId: 'u',
    ...p,
  };
}
function occ(p: Partial<RecurringOccurrence>): RecurringOccurrence {
  return {
    ruleId: 'r',
    name: 'x',
    amount: 1,
    type: 'EXPENSE',
    category: 'Credit',
    paymentMethod: 'CARD',
    frequency: 'MONTHLY',
    dueDate: '2026-10-18',
    status: 'due',
    transactionId: null,
    matchedByName: false,
    markedDone: false,
    ...p,
  };
}

const history = [
  tx({ name: 'Ovqat', amount: 2_000_000, date: '2026-09-10', category: 'Ovqat' }),
  tx({ name: 'Transport', amount: 500_000, date: '2026-09-11', category: 'Transport' }),
  tx({ name: 'Kia', amount: 3_760_000, date: '2026-09-18', category: 'Kredit' }), // fixed, excluded from variable
  tx({ name: 'Bozor', amount: 400_000, date: '2026-10-03', category: 'Ovqat' }), // spent this month
];

describe('buildMonthPlan', () => {
  const occurrences = [
    occ({
      ruleId: 'sal',
      name: 'Salary',
      type: 'INCOME',
      amount: 10_000_000,
      dueDate: '2026-10-05',
      status: 'received',
    }),
    occ({
      ruleId: 'adv',
      name: 'Advance',
      type: 'INCOME',
      amount: 5_000_000,
      dueDate: '2026-10-15',
      status: 'expected',
    }),
    occ({ ruleId: 'kia', name: 'Kia', amount: 3_760_000, dueDate: '2026-10-18', status: 'due' }),
    occ({
      ruleId: 'cl',
      name: 'Claude',
      amount: 670_000,
      dueDate: '2026-10-03',
      status: 'paid',
      transactionId: 'txn_c',
    }),
  ];

  it('ignores recurring-rule payments and investment contributions when budgeting living costs', () => {
    const plan = buildMonthPlan({
      month: '2026-10',
      today: '2026-10-08',
      occurrences,
      transactions: [
        ...history,
        tx({ name: 'Depozit', amount: 10_000_000, date: '2026-09-02', category: 'Deposit' }),
        tx({ name: 'BTC', amount: 2_000_000, date: '2026-10-02', category: 'Crypto' }),
      ],
      cash: null,
      annualRatePercent: 20,
    });
    expect(plan.variable.budget).toBe(2_500_000);
    expect(plan.variable.spent).toBe(400_000);
    expect(plan.variable.lines.map((l) => l.category)).toEqual(['Food', 'Transport']);
  });

  it('averages living costs over the past months that have data and keeps only living-cost groups', () => {
    const plan = buildMonthPlan({
      month: '2026-10',
      today: '2026-10-08',
      occurrences,
      transactions: [
        ...history,
        tx({ name: 'Ovqat', amount: 1_000_000, date: '2026-08-15', category: 'Ovqat' }),
        tx({ name: "Sovg'a", amount: 300_000, date: '2026-08-20', category: 'Boshqa' }),
        tx({ name: 'Old', amount: 9_000_000, date: '2026-03-01', category: 'Ovqat' }), // outside the 6-month window
      ],
      cash: null,
      annualRatePercent: 20,
    });
    expect(plan.variable.basis).toBe('6-month-average');
    expect(plan.variable.monthsOfHistory).toBe(2);
    // "Boshqa" belongs to no living-cost group and is left out; Kredit is fixed and left out
    expect(plan.variable.lines).toEqual([
      { category: 'Food', budget: 1_500_000, spent: 400_000, remaining: 1_100_000 },
      { category: 'Transport', budget: 250_000, spent: 0, remaining: 250_000 },
    ]);
  });

  it('derives the living-cost budget from history and tracks what is spent', () => {
    const plan = buildMonthPlan({
      month: '2026-10',
      today: '2026-10-08',
      occurrences,
      transactions: history,
      cash: null,
      annualRatePercent: 20,
    });
    expect(plan.variable.basis).toBe('6-month-average');
    expect(plan.variable.monthsOfHistory).toBe(1);
    expect(plan.variable.budget).toBe(2_500_000);
    expect(plan.variable.spent).toBe(400_000);
    expect(plan.variable.remaining).toBe(2_100_000);
    expect(plan.variable.lines[0]).toEqual({
      category: 'Food',
      budget: 2_000_000,
      spent: 400_000,
      remaining: 1_600_000,
    });
    expect(plan.buffer).toBe(250_000);
  });

  it('defaults cash to the current balance and lists unpaid fixed expenses', () => {
    const plan = buildMonthPlan({
      month: '2026-10',
      today: '2026-10-08',
      occurrences,
      transactions: [
        ...history,
        tx({
          name: 'Oylik',
          amount: 10_000_000,
          type: 'INCOME',
          date: '2026-09-05',
          category: 'Oylik',
        }),
      ],
      cash: null,
      annualRatePercent: 20,
    });
    expect(plan.cashIsDefault).toBe(true);
    // 10,000,000 income − (2,000,000 + 500,000 + 3,760,000 + 400,000) expenses
    expect(plan.currentBalance).toBe(3_340_000);
    expect(plan.cashOnHand).toBe(3_340_000);
    expect(plan.fixed.due.map((o) => o.name)).toEqual(['Kia']);
    expect(plan.fixed.paid.map((o) => o.name)).toEqual(['Claude']);
    expect(plan.fixed.dueTotal).toBe(3_760_000);
  });

  it('recommends investing what the balance never needs, in dated tranches', () => {
    const plan = buildMonthPlan({
      month: '2026-10',
      today: '2026-10-08',
      occurrences,
      transactions: history,
      cash: 8_000_000,
      annualRatePercent: 24,
    });
    // cash 8.0M, Kia 3.76M due on the 18th, 2.1M variable to spend, 250K buffer → ~1.89M free now
    expect(plan.recommendations[0]).toMatchObject({ date: '2026-10-08', amount: 1_890_000 });
    // advance salary of 5M on the 15th frees a second tranche
    expect(plan.recommendations[1]).toMatchObject({ date: '2026-10-15', amount: 5_000_000 });
    expect(plan.investableNow).toBe(1_890_000);
    expect(plan.expectedProfit).toEqual({
      monthly: Math.round((6_890_000 * 0.24) / 12),
      yearly: Math.round(6_890_000 * 0.24),
    });
    expect(plan.floor?.balance).toBeGreaterThanOrEqual(0);
    expect(plan.warnings).toEqual([]);
  });

  it('warns when cash cannot cover the month and never recommends investing', () => {
    const plan = buildMonthPlan({
      month: '2026-10',
      today: '2026-10-08',
      occurrences: occurrences.filter((o) => o.type === 'EXPENSE'),
      transactions: history,
      cash: 1_000_000,
      annualRatePercent: 20,
    });
    expect(plan.recommendations).toEqual([]);
    expect(plan.floor?.balance).toBeLessThan(0);
    expect(plan.warnings[0]).toMatchObject({ code: 'negative-balance' });
  });

  it('flags missing history', () => {
    const plan = buildMonthPlan({
      month: '2026-10',
      today: '2026-10-08',
      occurrences: [],
      transactions: [],
      cash: 1_000_000,
      annualRatePercent: 20,
    });
    expect(plan.variable.basis).toBe('none');
    expect(plan.warnings.some((w) => w.code === 'no-history')).toBe(true);
    expect(plan.recommendations[0]?.amount).toBe(1_000_000);
  });
});
