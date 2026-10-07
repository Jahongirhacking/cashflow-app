import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type CreateTransactionInput,
  createTransactionSchema,
  type Paginated,
  type Transaction,
  type TransactionQuery,
  transactionQuerySchema,
  type UpdateTransactionInput,
  updateTransactionSchema,
  type User,
} from '@finance/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(transactionQuerySchema)) query: TransactionQuery,
  ): Promise<Paginated<Transaction>> {
    return this.transactions.list(user, query);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(createTransactionSchema)) body: CreateTransactionInput,
  ): Promise<Transaction> {
    return this.transactions.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id') id: string): Promise<Transaction> {
    return this.transactions.getById(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTransactionSchema)) body: UpdateTransactionInput,
  ): Promise<Transaction> {
    return this.transactions.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.transactions.remove(user, id);
  }
}
