import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type CreateRecurringRuleInput,
  createRecurringRuleSchema,
  currentMonthKey,
  type MarkOccurrenceInput,
  markOccurrenceSchema,
  type RecurringRule,
  type RecurringSchedule,
  type UpdateRecurringRuleInput,
  updateRecurringRuleSchema,
  type User,
} from '@finance/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RecurringService } from './recurring.service';

const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

@Controller('recurring')
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<RecurringRule[]> {
    return this.recurring.list(user);
  }

  @Get('schedule')
  schedule(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(monthQuerySchema)) query: z.infer<typeof monthQuerySchema>,
  ): Promise<RecurringSchedule> {
    return this.recurring.schedule(user, query.month ?? currentMonthKey());
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createRecurringRuleSchema)) body: CreateRecurringRuleInput,
  ): Promise<RecurringRule> {
    return this.recurring.create(user, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRecurringRuleSchema)) body: UpdateRecurringRuleInput,
  ): Promise<RecurringRule> {
    return this.recurring.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.recurring.remove(user, id);
  }

  /** Reminder tick for one occurrence (no transaction is written). Returns the refreshed month schedule. */
  @Post(':id/done')
  @HttpCode(200)
  markDone(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(markOccurrenceSchema)) body: MarkOccurrenceInput,
  ): Promise<RecurringSchedule> {
    return this.recurring.markDone(user, id, body.dueDate, body.done);
  }
}
