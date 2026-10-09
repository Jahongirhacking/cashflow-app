import { Injectable } from '@nestjs/common';
import { type InvestmentsOverview, todayIsoDate, type User } from '@finance/shared';
import { TransactionsService } from '../transactions/transactions.service';
import { buildInvestmentsOverview } from './compute';

/** Investments are a view over the Deposit / Crypto / Stocks transactions; nothing is stored separately. */
@Injectable()
export class InvestmentsService {
  constructor(private readonly transactions: TransactionsService) {}

  async overview(user: User): Promise<InvestmentsOverview> {
    const transactions = await this.transactions.listAll(user);
    return buildInvestmentsOverview(transactions, todayIsoDate());
  }
}
