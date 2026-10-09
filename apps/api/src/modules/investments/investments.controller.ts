import { Controller, Get } from '@nestjs/common';
import type { InvestmentsOverview, User } from '@finance/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvestmentsService } from './investments.service';

@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investments: InvestmentsService) {}

  /** Positions per investment type (Deposit, Crypto, Stocks) derived from transactions, with totals and monthly flows. */
  @Get()
  overview(@CurrentUser() user: User): Promise<InvestmentsOverview> {
    return this.investments.overview(user);
  }
}
