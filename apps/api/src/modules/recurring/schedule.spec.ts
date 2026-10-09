import type { RecurringRule, Transaction } from '@finance/shared';
import { buildSchedule, nextOccurrence, occurrenceKey, occurrencesInMonth } from './schedule';

const base: RecurringRule = {
  id: 'rec_1',
  name: 'Kia Credit',
  amount: 3760000,
  type: 'EXPENSE',
  category: 'Credit',
  paymentMethod: 'CARD',
  frequency: 'MONTHLY',
  dayOfPeriod: 18,
  monthOfYear: null,
  startDate: '2026-01-18',
  endDate: null,
  nextDate: null,
  isActive: true,
  note: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  userId: 'u',
};

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 'txn_x',
    name: 'Kia Credit',
    amount: 3760000,
    type: 'EXPENSE',
    paymentMethod: 'CARD',
    date: '2026-10-18',
    time: null,
    category: 'Credit',
    note: null,
    isRecurring: false,
    recurringRuleId: null,
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
    userId: 'u',
    ...partial,
  };
}

describe('occurrencesInMonth', () => {
  it('handles monthly rules, short months and date bounds', () => {
    expect(occurrencesInMonth(base, '2026-10')).toEqual(['2026-10-18']);
    expect(occurrencesInMonth({ ...base, dayOfPeriod: 31 }, '2026-02')).toEqual(['2026-02-28']);
    expect(occurrencesInMonth(base, '2025-12')).toEqual([]); // before startDate
    expect(occurrencesInMonth({ ...base, endDate: '2026-10-10' }, '2026-10')).toEqual([]);
  });

  it('handles once, weekly, daily and yearly rules', () => {
    expect(
      occurrencesInMonth({ ...base, frequency: 'ONCE', startDate: '2026-10-25' }, '2026-10'),
    ).toEqual(['2026-10-25']);
    expect(
      occurrencesInMonth({ ...base, frequency: 'ONCE', startDate: '2026-10-25' }, '2026-11'),
    ).toEqual([]);
    expect(
      occurrencesInMonth(
        { ...base, frequency: 'WEEKLY', dayOfPeriod: 1, startDate: '2026-10-01' },
        '2026-10',
      ),
    ).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
    expect(
      occurrencesInMonth({ ...base, frequency: 'DAILY', startDate: '2026-10-29' }, '2026-10'),
    ).toEqual(['2026-10-29', '2026-10-30', '2026-10-31']);
    expect(
      occurrencesInMonth(
        { ...base, frequency: 'YEARLY', monthOfYear: 10, dayOfPeriod: 1 },
        '2026-10',
      ),
    ).toEqual(['2026-10-01']);
    expect(
      occurrencesInMonth(
        { ...base, frequency: 'YEARLY', monthOfYear: 11, dayOfPeriod: 1 },
        '2026-10',
      ),
    ).toEqual([]);
  });

  it('finds the next occurrence across months', () => {
    expect(nextOccurrence(base, '2026-10-19')).toBe('2026-11-18');
    expect(nextOccurrence(base, '2026-10-18')).toBe('2026-10-18');
    expect(nextOccurrence({ ...base, isActive: false }, '2026-10-01')).toBeNull();
    expect(
      nextOccurrence({ ...base, frequency: 'ONCE', startDate: '2026-09-01' }, '2026-10-01'),
    ).toBeNull();
  });
});

describe('buildSchedule', () => {
  const salary: RecurringRule = {
    ...base,
    id: 'rec_sal',
    name: 'Salary',
    type: 'INCOME',
    category: 'Salary',
    amount: 17413296,
    dayOfPeriod: 5,
  };
  const advance: RecurringRule = {
    ...salary,
    id: 'rec_adv',
    name: 'Advance salary',
    amount: 5000000,
    dayOfPeriod: 15,
  };

  it('marks paid/overdue/due and received/expected using linked and name-matched transactions', () => {
    const occurrences = buildSchedule(
      [base, salary, advance],
      [
        tx({ id: 'txn_a', recurringRuleId: 'rec_1', date: '2026-10-17' }),
        tx({ id: 'txn_s', name: 'salary ', type: 'INCOME', amount: 17413296, date: '2026-10-05' }),
      ],
      '2026-10',
      '2026-10-20',
    );
    expect(occurrences.map((o) => [o.name, o.status, o.transactionId, o.matchedByName])).toEqual([
      ['Salary', 'received', 'txn_s', true],
      ['Advance salary', 'expected', null, false],
      ['Kia Credit', 'paid', 'txn_a', false],
    ]);
  });

  it('reports overdue and due based on today', () => {
    const occurrences = buildSchedule([base, advance], [], '2026-10', '2026-10-20');
    expect(occurrences.find((o) => o.name === 'Kia Credit')?.status).toBe('overdue');
    expect(buildSchedule([base], [], '2026-10', '2026-10-10')[0]?.status).toBe('due');
    expect(occurrences.find((o) => o.name === 'Advance salary')?.status).toBe('expected');
  });

  it('treats manually ticked reminders as paid without any transaction', () => {
    const done = new Set([occurrenceKey('rec_1', '2026-10-18')]);
    const [kia] = buildSchedule([base], [], '2026-10', '2026-10-20', done);
    expect(kia).toMatchObject({ status: 'paid', markedDone: true, transactionId: null });
    const [notDone] = buildSchedule(
      [base],
      [],
      '2026-10',
      '2026-10-20',
      new Set(['rec_1@2026-11-18']),
    );
    expect(notDone).toMatchObject({ status: 'overdue', markedDone: false });
  });

  it('never reuses one transaction for two occurrences', () => {
    const weekly: RecurringRule = {
      ...base,
      id: 'rec_w',
      name: 'Gym',
      frequency: 'WEEKLY',
      dayOfPeriod: 1,
      startDate: '2026-10-01',
      amount: 50000,
    };
    const occurrences = buildSchedule(
      [weekly],
      [tx({ id: 'txn_g', name: 'Gym', amount: 50000, date: '2026-10-05' })],
      '2026-10',
      '2026-10-31',
    );
    expect(occurrences.filter((o) => o.status === 'paid')).toHaveLength(1);
    expect(occurrences.filter((o) => o.status === 'overdue')).toHaveLength(3);
  });
});
