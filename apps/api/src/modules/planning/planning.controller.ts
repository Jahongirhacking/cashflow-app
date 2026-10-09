import { Controller, Get, Query } from '@nestjs/common';
import { currentMonthKey, type MonthPlan, type User } from '@finance/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlanningService } from './planning.service';

const querySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  cash: z.coerce.number().min(0).max(1e13).optional(),
  rate: z.coerce.number().min(0).max(200).default(20),
});

@Controller('planning')
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get('month')
  month(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(querySchema)) q: z.infer<typeof querySchema>,
  ): Promise<MonthPlan> {
    return this.planning.monthPlan(user, q.month ?? currentMonthKey(), q.cash ?? null, q.rate);
  }
}
