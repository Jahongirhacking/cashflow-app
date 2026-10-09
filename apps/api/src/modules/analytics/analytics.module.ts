import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { SpreadsheetsModule } from '../spreadsheets/spreadsheets.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [SpreadsheetsModule, TransactionsModule, CategoriesModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
