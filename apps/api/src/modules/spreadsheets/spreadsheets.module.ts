import { Module } from '@nestjs/common';
import { SheetsClient, SpreadsheetService } from '@finance/shared';
import { AppConfigService } from '../../config/app-config.service';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { SpreadsheetsController } from './spreadsheets.controller';

@Module({
  imports: [UsersModule],
  controllers: [SpreadsheetsController],
  providers: [
    {
      provide: SpreadsheetService,
      inject: [SheetsClient, UsersService, AppConfigService],
      useFactory: (client: SheetsClient, users: UsersService, config: AppConfigService) =>
        new SpreadsheetService(client, users, {
          canAccessSheets:
            config.googleServiceAccount !== null || config.sheetsBackend === 'memory',
          serviceAccountEmail:
            config.serviceAccountEmail ??
            (config.sheetsBackend === 'memory' ? 'demo-bot@finance.local' : null),
        }),
    },
  ],
  exports: [SpreadsheetService],
})
export class SpreadsheetsModule {}
