import { Body, Controller, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  type ImportCommitInput,
  importCommitSchema,
  type ImportPreview,
  type ImportResult,
  type User,
} from '@finance/shared';
import { AppException } from '../../../common/errors/app.exception';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ImportService } from './import.service';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** The subset of multer's file object we rely on (avoids the global Express.Multer typings). */
interface UploadedWorkbook {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Controller('transactions/import')
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  /** Step 1: upload the .xlsx and get a preview (nothing is written). */
  @Post('preview')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
  preview(
    @CurrentUser() user: User,
    @UploadedFile() file?: UploadedWorkbook,
  ): Promise<ImportPreview> {
    if (!file)
      throw AppException.validation([{ path: 'file', message: 'Choose an .xlsx file to import.' }]);
    if (!/\.xlsx$/i.test(file.originalname) && !file.mimetype.includes('spreadsheetml')) {
      throw AppException.validation([
        { path: 'file', message: 'Only .xlsx workbooks are supported.' },
      ]);
    }
    return this.imports.preview(user, file.originalname, file.buffer);
  }

  /** Step 2: write the reviewed rows to the spreadsheet in one batch. */
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  commit(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(importCommitSchema)) body: ImportCommitInput,
  ): Promise<ImportResult> {
    return this.imports.commit(user, body);
  }
}
