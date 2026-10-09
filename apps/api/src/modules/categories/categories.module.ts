import { Module } from '@nestjs/common';
import { SpreadsheetsModule } from '../spreadsheets/spreadsheets.module';
import { CategoriesController } from './categories.controller';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

@Module({
  imports: [SpreadsheetsModule],
  controllers: [CategoriesController],
  providers: [CategoriesRepository, CategoriesService],
  exports: [CategoriesService, CategoriesRepository],
})
export class CategoriesModule {}
