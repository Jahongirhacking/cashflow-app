import path from 'node:path';
import { Logger, Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { SheetsClient } from '../google-sheets/sheets-client';
import { FileUsersRepository } from './file-users.repository';
import { SheetsUsersRepository } from './sheets-users.repository';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  providers: [
    {
      provide: UsersRepository,
      inject: [AppConfigService, SheetsClient],
      useFactory: (config: AppConfigService, sheets: SheetsClient): UsersRepository => {
        const logger = new Logger('UsersModule');
        const registry = config.registrySpreadsheetId;
        if (registry && config.googleServiceAccount) {
          logger.log(`User registry: Google Sheet ${registry}`);
          return new SheetsUsersRepository(sheets, registry);
        }
        const file = path.resolve(config.dataDir, 'users.json');
        if (config.isProduction)
          logger.warn(
            `User registry: local file ${file} (set GOOGLE_SPREADSHEET_ID for production)`,
          );
        else logger.log(`User registry: local file ${file}`);
        return new FileUsersRepository(file);
      },
    },
    UsersService,
  ],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
