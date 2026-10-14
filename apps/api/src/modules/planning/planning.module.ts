import { Module } from '@nestjs/common';
import { AnalyticsService, PlanningService, RecurringService } from '@finance/shared';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RecurringModule } from '../recurring/recurring.module';
import { PlanningController } from './planning.controller';

@Module({
  imports: [AnalyticsModule, RecurringModule],
  controllers: [PlanningController],
  providers: [
    {
      provide: PlanningService,
      inject: [AnalyticsService, RecurringService],
      useFactory: (analytics: AnalyticsService, recurring: RecurringService) =>
        new PlanningService(analytics, recurring),
    },
  ],
})
export class PlanningModule {}
