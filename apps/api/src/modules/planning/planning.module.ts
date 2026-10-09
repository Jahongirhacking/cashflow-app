import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RecurringModule } from '../recurring/recurring.module';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

@Module({
  imports: [AnalyticsModule, RecurringModule],
  controllers: [PlanningController],
  providers: [PlanningService],
})
export class PlanningModule {}
