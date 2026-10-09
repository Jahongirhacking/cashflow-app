import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { SpreadsheetsModule } from '../spreadsheets/spreadsheets.module';
import { ExportController } from './export/export.controller';
import { ExportService } from './export/export.service';
import { ImportController } from './import/import.controller';
import { ImportService } from './import/import.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsRepository } from './transactions.repository';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [SpreadsheetsModule, CategoriesModule],
  controllers: [ImportController, ExportController, TransactionsController],
  providers: [TransactionsRepository, TransactionsService, ImportService, ExportService],
  exports: [TransactionsService, TransactionsRepository],
})
export class TransactionsModule {}
