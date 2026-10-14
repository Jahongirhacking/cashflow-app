import { Module } from '@nestjs/common';
import { InvestmentsService, TransactionsService } from '@finance/shared';
import { TransactionsModule } from '../transactions/transactions.module';
import { InvestmentsController } from './investments.controller';

@Module({
  imports: [TransactionsModule],
  controllers: [InvestmentsController],
  providers: [
    {
      provide: InvestmentsService,
      inject: [TransactionsService],
      useFactory: (transactions: TransactionsService) => new InvestmentsService(transactions),
    },
  ],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
