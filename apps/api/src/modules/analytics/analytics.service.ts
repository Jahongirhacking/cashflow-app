import { Injectable } from '@nestjs/common';
import {
  type AnalyticsOverview,
  type AnalyticsPeriod,
  type Category,
  type CategoryBreakdown,
  type FixedVariableBreakdown,
  type MonthlyCashFlowPoint,
  type SpendingTrend,
  todayIsoDate,
  type Transaction,
  type User,
} from '@finance/shared';
import { CategoriesRepository } from '../categories/categories.repository';
import { SpreadsheetService } from '../spreadsheets/spreadsheet.service';
import { TransactionsService } from '../transactions/transactions.service';
import {
  buildInsights,
  categoryBreakdown,
  createClassifier,
  fixedVariable,
  type KindClassifier,
  monthlyCashFlow,
  percentChange,
  projectMonthlySavings,
  spendingTrend,
  summarise,
} from './compute';
import { resolvePeriod } from './period';

interface Dataset {
  transactions: Transaction[];
  categories: Category[];
  classify: KindClassifier;
  today: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly spreadsheets: SpreadsheetService,
    private readonly transactions: TransactionsService,
    private readonly categories: CategoriesRepository,
  ) {}

  async dataset(user: User): Promise<Dataset> {
    const ctx = await this.spreadsheets.getContext(user);
    const [transactions, categories] = await Promise.all([
      this.transactions.listAll(user),
      this.categories.list(ctx, user.id),
    ]);
    const today = todayIsoDate();
    return {
      transactions,
      categories,
      classify: createClassifier(categories, transactions, today),
      today,
    };
  }

  async overview(user: User, period: AnalyticsPeriod): Promise<AnalyticsOverview> {
    const { transactions, classify, today } = await this.dataset(user);
    const firstDate = transactions.reduce<string | null>(
      (min, t) => (min === null || t.date < min ? t.date : min),
      null,
    );
    const range = resolvePeriod(period, today, firstDate);
    const summary = summarise(transactions, range.from, range.to);
    const previous = summarise(transactions, range.previousFrom, range.previousTo);
    const trend = spendingTrend(transactions, range.from, range.to, today);
    const expenseChangePercent = percentChange(summary.expenses, previous.expenses);
    const projectedMonthlySavings = range.isCurrentMonth
      ? projectMonthlySavings(summary, today)
      : null;
    const topExpense = categoryBreakdown(
      transactions,
      'EXPENSE',
      range.from,
      range.to,
      classify,
    ).items;
    const topIncome = categoryBreakdown(
      transactions,
      'INCOME',
      range.from,
      range.to,
      classify,
    ).items;
    const balanceByPaymentMethod: Record<string, number> = {};
    let totalBalance = 0;
    for (const t of transactions) {
      const signed = t.type === 'INCOME' ? t.amount : -t.amount;
      totalBalance += signed;
      balanceByPaymentMethod[t.paymentMethod] =
        (balanceByPaymentMethod[t.paymentMethod] ?? 0) + signed;
    }
    return {
      period,
      summary,
      previous,
      expenseChangePercent,
      incomeChangePercent: percentChange(summary.income, previous.income),
      averageDailySpending: trend.averageDaily,
      projectedMonthlySavings,
      totalBalance,
      balanceByPaymentMethod,
      topExpenseCategories: topExpense.slice(0, 6),
      topIncomeCategories: topIncome.slice(0, 6),
      insights: buildInsights({
        summary,
        previous,
        expenseChangePercent,
        averageDailySpending: trend.averageDaily,
        projectedMonthlySavings,
        topExpense: topExpense[0],
        isCurrentMonth: range.isCurrentMonth,
      }),
    };
  }

  async monthly(user: User, months: number): Promise<MonthlyCashFlowPoint[]> {
    const { transactions, today } = await this.dataset(user);
    return monthlyCashFlow(transactions, months, today.slice(0, 7));
  }

  async categoriesBreakdown(
    user: User,
    period: AnalyticsPeriod,
    type: 'INCOME' | 'EXPENSE',
  ): Promise<CategoryBreakdown> {
    const { transactions, classify, today } = await this.dataset(user);
    const range = resolvePeriod(period, today, firstDateOf(transactions));
    return categoryBreakdown(transactions, type, range.from, range.to, classify);
  }

  async fixedVariable(user: User, period: AnalyticsPeriod): Promise<FixedVariableBreakdown> {
    const { transactions, classify, today } = await this.dataset(user);
    const range = resolvePeriod(period, today, firstDateOf(transactions));
    return fixedVariable(transactions, range.from, range.to, classify);
  }

  async trend(user: User, period: AnalyticsPeriod): Promise<SpendingTrend> {
    const { transactions, today } = await this.dataset(user);
    const range = resolvePeriod(period, today, firstDateOf(transactions));
    return spendingTrend(transactions, range.from, range.to, today);
  }
}

function firstDateOf(transactions: Transaction[]): string | null {
  return transactions.reduce<string | null>(
    (min, t) => (min === null || t.date < min ? t.date : min),
    null,
  );
}
