import { Module } from '@nestjs/common';
import {
  CategoriesRepository,
  CategoriesService,
  SheetsClient,
  SpreadsheetService,
} from '@finance/shared';
import { SpreadsheetsModule } from '../spreadsheets/spreadsheets.module';
import { CategoriesController } from './categories.controller';

@Module({
  imports: [SpreadsheetsModule],
  controllers: [CategoriesController],
  providers: [
    {
      provide: CategoriesRepository,
      inject: [SheetsClient],
      useFactory: (client: SheetsClient) => new CategoriesRepository(client),
    },
    {
      provide: CategoriesService,
      inject: [SpreadsheetService, CategoriesRepository],
      useFactory: (spreadsheets: SpreadsheetService, repo: CategoriesRepository) =>
        new CategoriesService(spreadsheets, repo),
    },
  ],
  exports: [CategoriesService, CategoriesRepository],
})
export class CategoriesModule {}
