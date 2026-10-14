import { Module } from '@nestjs/common';
import {
  AnalyticsService,
  CategoriesRepository,
  SpreadsheetService,
  TransactionsService,
} from '@finance/shared';
import { CategoriesModule } from '../categories/categories.module';
import { SpreadsheetsModule } from '../spreadsheets/spreadsheets.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [SpreadsheetsModule, TransactionsModule, CategoriesModule],
  controllers: [AnalyticsController],
  providers: [
    {
      provide: AnalyticsService,
      inject: [SpreadsheetService, TransactionsService, CategoriesRepository],
      useFactory: (
        spreadsheets: SpreadsheetService,
        transactions: TransactionsService,
        categories: CategoriesRepository,
      ) => new AnalyticsService(spreadsheets, transactions, categories),
    },
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
