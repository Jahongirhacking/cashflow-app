import { Global, Logger, Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { DEMO_SPREADSHEET_URL, seedDemoSpreadsheet } from './demo-spreadsheet';
import { GoogleSheetsClient } from './google-sheets.client';
import { InMemorySheetsClient } from './in-memory-sheets.client';
import { SheetsClient } from './sheets-client';

@Global()
@Module({
  providers: [
    {
      provide: SheetsClient,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): SheetsClient => {
        if (config.sheetsBackend === 'memory') {
          const logger = new Logger('GoogleSheetsModule');
          if (config.isProduction)
            throw new Error('SHEETS_BACKEND=memory is not allowed in production');
          logger.warn(
            'SHEETS_BACKEND=memory: using an in-memory demo spreadsheet, nothing is written to Google',
          );
          logger.warn(`Connect it in the setup wizard with ${DEMO_SPREADSHEET_URL}`);
          const client = new InMemorySheetsClient();
          seedDemoSpreadsheet(client);
          return client;
        }
        return new GoogleSheetsClient(config);
      },
    },
  ],
  exports: [SheetsClient],
})
export class GoogleSheetsModule {}
