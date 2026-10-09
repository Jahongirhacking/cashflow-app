import { Module } from '@nestjs/common';
import { SpreadsheetsModule } from '../spreadsheets/spreadsheets.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { RecurringController } from './recurring.controller';
import { RecurringRepository } from './recurring.repository';
import { RecurringService } from './recurring.service';

@Module({
  imports: [SpreadsheetsModule, TransactionsModule],
  controllers: [RecurringController],
  providers: [RecurringRepository, RecurringService],
  exports: [RecurringService, RecurringRepository],
})
export class RecurringModule {}
