import { Body, Controller, Get, Header, Put, StreamableFile } from '@nestjs/common';
import {
  type ExportCategoryMap,
  exportCategoryMapSchema,
  type ExportCategorySettings,
  type User,
} from '@finance/shared';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ExportService } from './export.service';

@Controller('transactions/export')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  /** Download every transaction as .xlsx in the import layout, with categories renamed per the saved mapping. */
  @Get()
  @Header('Cache-Control', 'no-store')
  async download(@CurrentUser() user: User): Promise<StreamableFile> {
    const buffer = await this.exports.workbook(user);
    const stamp = new Date().toISOString().slice(0, 10);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="finance-transactions-${stamp}.xlsx"`,
      length: buffer.length,
    });
  }

  /** App categories with their Excel names (many app categories may share one Excel name). */
  @Get('categories')
  categories(@CurrentUser() user: User): Promise<ExportCategorySettings> {
    return this.exports.settings(user);
  }

  /** Replace the saved mapping. Unmapped categories keep their app name in the file. */
  @Put('categories')
  save(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(exportCategoryMapSchema)) body: ExportCategoryMap,
  ): Promise<ExportCategorySettings> {
    return this.exports.saveMap(user, body);
  }
}
