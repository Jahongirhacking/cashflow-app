import { Injectable } from '@nestjs/common';
import { type MonthPlan, todayIsoDate, type User } from '@finance/shared';
import { AnalyticsService } from '../analytics/analytics.service';
import { RecurringService } from '../recurring/recurring.service';
import { buildMonthPlan } from './plan';

@Injectable()
export class PlanningService {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly recurring: RecurringService,
  ) {}

  async monthPlan(
    user: User,
    month: string,
    cash: number | null,
    annualRatePercent: number,
  ): Promise<MonthPlan> {
    const [{ transactions }, schedule] = await Promise.all([
      this.analytics.dataset(user),
      this.recurring.schedule(user, month),
    ]);
    return buildMonthPlan({
      month,
      today: todayIsoDate(),
      occurrences: schedule.occurrences,
      transactions,
      cash,
      annualRatePercent,
    });
  }
}
