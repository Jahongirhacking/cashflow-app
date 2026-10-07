import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  type ConnectSpreadsheetInput,
  connectSpreadsheetSchema,
  type SpreadsheetInfo,
  type SpreadsheetStatus,
  type User,
} from '@finance/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SpreadsheetService } from './spreadsheet.service';

@Controller('spreadsheets')
export class SpreadsheetsController {
  constructor(private readonly spreadsheets: SpreadsheetService) {}

  @Get('status')
  status(@CurrentUser() user: User): SpreadsheetStatus {
    return this.spreadsheets.status(user);
  }

  @Post('connect')
  @HttpCode(200)
  connect(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(connectSpreadsheetSchema)) body: ConnectSpreadsheetInput,
  ): Promise<SpreadsheetStatus> {
    return this.spreadsheets.connect(user, body.spreadsheetUrl);
  }

  /** Same as connect; kept as a distinct route so the client can express intent. */
  @Post('reconnect')
  @HttpCode(200)
  reconnect(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(connectSpreadsheetSchema)) body: ConnectSpreadsheetInput,
  ): Promise<SpreadsheetStatus> {
    return this.spreadsheets.connect(user, body.spreadsheetUrl);
  }

  @Post('verify')
  @HttpCode(200)
  verify(@CurrentUser() user: User): Promise<SpreadsheetStatus> {
    return this.spreadsheets.verify(user);
  }

  @Get('info')
  info(@CurrentUser() user: User): Promise<SpreadsheetInfo> {
    return this.spreadsheets.info(user);
  }
}
