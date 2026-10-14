import { Module } from '@nestjs/common';
import {
  SheetsClient,
  SpreadsheetService,
  TransactionsRepository,
  TransactionsService,
} from '@finance/shared';
import { CategoriesModule } from '../categories/categories.module';
import { SpreadsheetsModule } from '../spreadsheets/spreadsheets.module';
import { ExportController } from './export/export.controller';
import { ExportService } from './export/export.service';
import { ImportController } from './import/import.controller';
import { ImportService } from './import/import.service';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [SpreadsheetsModule, CategoriesModule],
  controllers: [ImportController, ExportController, TransactionsController],
  providers: [
    {
      provide: TransactionsRepository,
      inject: [SheetsClient],
      useFactory: (client: SheetsClient) => new TransactionsRepository(client),
    },
    {
      provide: TransactionsService,
      inject: [SpreadsheetService, TransactionsRepository],
      useFactory: (spreadsheets: SpreadsheetService, repo: TransactionsRepository) =>
        new TransactionsService(spreadsheets, repo),
    },
    ImportService,
    ExportService,
  ],
  exports: [TransactionsService, TransactionsRepository],
})
export class TransactionsModule {}
