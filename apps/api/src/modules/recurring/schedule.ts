import {
  addDays,
  daysInMonth,
  parseIsoDate,
  type RecurringOccurrence,
  type RecurringRule,
  toIsoDate,
  type Transaction,
} from '@finance/shared';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function clampDay(monthKey: string, day: number): string {
  return `${monthKey}-${pad(Math.min(Math.max(day, 1), daysInMonth(monthKey)))}`;
}

function withinRule(rule: RecurringRule, date: string): boolean {
  if (date < rule.startDate) return false;
  if (rule.endDate && date > rule.endDate) return false;
  return true;
}

/** Every date on which `rule` falls inside `monthKey` (YYYY-MM), in ascending order. */
export function occurrencesInMonth(rule: RecurringRule, monthKey: string): string[] {
  const monthStart = `${monthKey}-01`;
  const monthEnd = clampDay(monthKey, 31);
  const inRange = (d: string) => d >= monthStart && d <= monthEnd && withinRule(rule, d);
  switch (rule.frequency) {
    case 'ONCE':
      return inRange(rule.startDate) ? [rule.startDate] : [];
    case 'DAILY': {
      const out: string[] = [];
      for (let d = monthStart; d <= monthEnd; d = addDays(d, 1)) if (inRange(d)) out.push(d);
      return out;
    }
    case 'WEEKLY': {
      const weekday = rule.dayOfPeriod ?? parseIsoDate(rule.startDate).getDay();
      const out: string[] = [];
      for (let d = monthStart; d <= monthEnd; d = addDays(d, 1)) {
        if (parseIsoDate(d).getDay() === weekday && inRange(d)) out.push(d);
      }
      return out;
    }
    case 'MONTHLY': {
      const day = rule.dayOfPeriod ?? Number(rule.startDate.slice(8, 10));
      const date = clampDay(monthKey, day);
      return inRange(date) ? [date] : [];
    }
    case 'YEARLY': {
      const month = rule.monthOfYear ?? Number(rule.startDate.slice(5, 7));
      if (Number(monthKey.slice(5, 7)) !== month) return [];
      const day = rule.dayOfPeriod ?? Number(rule.startDate.slice(8, 10));
      const date = clampDay(monthKey, day);
      return inRange(date) ? [date] : [];
    }
    default:
      return [];
  }
}

/** First occurrence on or after `fromDate` within the next 24 months, or null. */
export function nextOccurrence(rule: RecurringRule, fromDate: string): string | null {
  if (!rule.isActive) return null;
  let month = fromDate.slice(0, 7);
  for (let i = 0; i < 24; i += 1) {
    const found = occurrencesInMonth(rule, month).find((d) => d >= fromDate);
    if (found) return found;
    const [y, m] = month.split('-').map(Number);
    const next = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + 1, 1));
    month = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`;
  }
  return null;
}

function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Pair this month's occurrences with the transactions that settled them.
 * A transaction linked by `recurringRuleId` wins; otherwise a same-name, same-type
 * transaction in the month is treated as the payment (matchedByName = true).
 */
export function occurrenceKey(ruleId: string, dueDate: string): string {
  return `${ruleId}@${dueDate}`;
}

export function buildSchedule(
  rules: RecurringRule[],
  transactions: Transaction[],
  monthKey: string,
  today: string,
  doneKeys: ReadonlySet<string> = new Set(),
): RecurringOccurrence[] {
  const monthTx = transactions.filter((t) => t.date.startsWith(monthKey));
  const used = new Set<string>();
  const occurrences: RecurringOccurrence[] = [];

  for (const rule of rules) {
    if (!rule.isActive && rule.frequency !== 'ONCE') continue;
    const dates = occurrencesInMonth(rule, monthKey);
    if (dates.length === 0) continue;
    const linked = monthTx
      .filter((t) => t.recurringRuleId === rule.id && !used.has(t.id))
      .sort((a, b) => a.date.localeCompare(b.date));
    const byName = monthTx
      .filter(
        (t) =>
          !t.recurringRuleId &&
          t.type === rule.type &&
          normalise(t.name) === normalise(rule.name) &&
          !used.has(t.id),
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const dueDate of dates) {
      let match = linked.shift() ?? null;
      let matchedByName = false;
      if (!match) {
        match = byName.shift() ?? null;
        matchedByName = match !== null;
      }
      if (match) used.add(match.id);
      const markedDone = doneKeys.has(occurrenceKey(rule.id, dueDate));
      const settled = match !== null || markedDone;
      const status: RecurringOccurrence['status'] =
        rule.type === 'INCOME'
          ? settled
            ? 'received'
            : 'expected'
          : settled
            ? 'paid'
            : dueDate < today
              ? 'overdue'
              : 'due';
      occurrences.push({
        ruleId: rule.id,
        name: rule.name,
        amount: match?.amount ?? rule.amount,
        type: rule.type,
        category: rule.category,
        paymentMethod: rule.paymentMethod,
        frequency: rule.frequency,
        dueDate,
        status,
        transactionId: match?.id ?? null,
        matchedByName,
        markedDone,
      });
    }
  }

  return occurrences.sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name),
  );
}

export function currentMonthFrom(date: Date): string {
  return toIsoDate(date).slice(0, 7);
}
