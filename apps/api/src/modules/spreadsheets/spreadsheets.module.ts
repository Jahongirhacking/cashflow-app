import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SpreadsheetService } from './spreadsheet.service';
import { SpreadsheetsController } from './spreadsheets.controller';

@Module({
  imports: [UsersModule],
  controllers: [SpreadsheetsController],
  providers: [SpreadsheetService],
  exports: [SpreadsheetService],
})
export class SpreadsheetsModule {}
