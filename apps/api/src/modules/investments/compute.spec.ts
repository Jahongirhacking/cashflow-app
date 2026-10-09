import type { Transaction } from '@finance/shared';
import { buildInvestmentsOverview, recentMonths } from './compute';

function tx(
  partial: Partial<Transaction> & Pick<Transaction, 'amount' | 'type' | 'category' | 'date'>,
): Transaction {
  return {
    id: `txn_${Math.random().toString(36).slice(2)}`,
    name: partial.category,
    paymentMethod: 'CARD',
    time: null,
    note: null,
    isRecurring: false,
    recurringRuleId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    userId: 'usr_1',
    ...partial,
  };
}

describe('investments compute', () => {
  it('lists the last months oldest first, crossing a year boundary', () => {
    expect(recentMonths('2026-02-10', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('derives positions from Deposit, Crypto and Stocks transactions only', () => {
    const o = buildInvestmentsOverview(
      [
        tx({ amount: 10_000_000, type: 'EXPENSE', category: 'Deposit', date: '2026-08-01' }),
        tx({ amount: 150_000, type: 'INCOME', category: 'deposit', date: '2026-09-01' }),
        tx({ amount: 150_000, type: 'INCOME', category: 'Deposit', date: '2026-10-01' }),
        tx({ amount: 2_000_000, type: 'EXPENSE', category: 'Crypto', date: '2026-10-03' }),
        tx({ amount: 2_600_000, type: 'INCOME', category: 'Crypto', date: '2026-10-05' }),
        tx({ amount: 85_000, type: 'EXPENSE', category: 'Food', date: '2026-10-05' }),
        tx({ amount: 17_000_000, type: 'INCOME', category: 'Salary', date: '2026-10-05' }),
      ],
      '2026-10-09',
      3,
    );
    expect(o.positions.map((p) => p.type)).toEqual(['DEPOSIT', 'CRYPTO', 'STOCK']);
    const deposit = o.positions[0];
    expect(deposit).toMatchObject({
      category: 'Deposit',
      invested: 10_000_000,
      returned: 300_000,
      net: -9_700_000,
      transactionCount: 3,
      firstDate: '2026-08-01',
      lastDate: '2026-10-01',
    });
    // August is outside the 3-month window: all-time totals still include it, the chart does not
    expect(deposit?.monthly).toEqual([
      { month: '2026-08', invested: 10_000_000, returned: 0, net: -10_000_000 },
      { month: '2026-09', invested: 0, returned: 150_000, net: 150_000 },
      { month: '2026-10', invested: 0, returned: 150_000, net: 150_000 },
    ]);
    expect(o.positions[1]).toMatchObject({
      type: 'CRYPTO',
      invested: 2_000_000,
      returned: 2_600_000,
      net: 600_000,
    });
    expect(o.positions[2]).toMatchObject({
      type: 'STOCK',
      invested: 0,
      returned: 0,
      transactionCount: 0,
      firstDate: null,
    });
    expect(o.summary).toEqual({
      invested: 12_000_000,
      returned: 2_900_000,
      net: -9_100_000,
      transactionCount: 5,
      activeTypes: 2,
    });
    expect(o.monthly[2]).toEqual({
      month: '2026-10',
      invested: 2_000_000,
      returned: 2_750_000,
      net: 750_000,
    });
  });

  it('returns empty positions for a sheet without investment transactions', () => {
    const o = buildInvestmentsOverview([], '2026-10-09', 2);
    expect(o.summary).toEqual({
      invested: 0,
      returned: 0,
      net: 0,
      transactionCount: 0,
      activeTypes: 0,
    });
    expect(o.monthly.map((m) => m.month)).toEqual(['2026-09', '2026-10']);
  });
});
