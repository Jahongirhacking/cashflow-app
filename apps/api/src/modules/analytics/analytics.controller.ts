import { Controller, Get, Query } from '@nestjs/common';
import {
  ANALYTICS_PERIODS,
  type AnalyticsOverview,
  type CategoryBreakdown,
  type FixedVariableBreakdown,
  type MonthlyCashFlowPoint,
  type SpendingTrend,
  type User,
} from '@finance/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

const periodSchema = z.object({ period: z.enum(ANALYTICS_PERIODS).default('month') });
const monthsSchema = z.object({ months: z.coerce.number().int().min(1).max(36).default(6) });
const categoriesSchema = periodSchema.extend({
  type: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
});

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(periodSchema)) q: z.infer<typeof periodSchema>,
  ): Promise<AnalyticsOverview> {
    return this.analytics.overview(user, q.period);
  }

  @Get('monthly')
  monthly(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(monthsSchema)) q: z.infer<typeof monthsSchema>,
  ): Promise<MonthlyCashFlowPoint[]> {
    return this.analytics.monthly(user, q.months);
  }

  @Get('categories')
  categories(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(categoriesSchema)) q: z.infer<typeof categoriesSchema>,
  ): Promise<CategoryBreakdown> {
    return this.analytics.categoriesBreakdown(user, q.period, q.type);
  }

  @Get('fixed-variable')
  fixedVariable(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(periodSchema)) q: z.infer<typeof periodSchema>,
  ): Promise<FixedVariableBreakdown> {
    return this.analytics.fixedVariable(user, q.period);
  }

  @Get('trend')
  trend(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(periodSchema)) q: z.infer<typeof periodSchema>,
  ): Promise<SpendingTrend> {
    return this.analytics.trend(user, q.period);
  }
}
