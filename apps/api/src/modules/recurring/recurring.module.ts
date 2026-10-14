import { Module } from '@nestjs/common';
import {
  RecurringRepository,
  RecurringService,
  SheetsClient,
  SpreadsheetService,
  TransactionsService,
} from '@finance/shared';
import { SpreadsheetsModule } from '../spreadsheets/spreadsheets.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { RecurringController } from './recurring.controller';

@Module({
  imports: [SpreadsheetsModule, TransactionsModule],
  controllers: [RecurringController],
  providers: [
    {
      provide: RecurringRepository,
      inject: [SheetsClient],
      useFactory: (client: SheetsClient) => new RecurringRepository(client),
    },
    {
      provide: RecurringService,
      inject: [SpreadsheetService, RecurringRepository, TransactionsService, SheetsClient],
      useFactory: (
        spreadsheets: SpreadsheetService,
        repo: RecurringRepository,
        transactions: TransactionsService,
        sheets: SheetsClient,
      ) => new RecurringService(spreadsheets, repo, transactions, sheets),
    },
  ],
  exports: [RecurringService, RecurringRepository],
})
export class RecurringModule {}
