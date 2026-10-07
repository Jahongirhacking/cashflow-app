import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { AuthModule } from './modules/auth/auth.module';
import { GoogleSheetsModule } from './modules/google-sheets/google-sheets.module';
import { HealthModule } from './modules/health/health.module';
import { SpreadsheetsModule } from './modules/spreadsheets/spreadsheets.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => [
        { name: 'default', ttl: config.throttle.ttlSeconds * 1000, limit: config.throttle.limit },
      ],
    }),
    GoogleSheetsModule,
    HealthModule,
    UsersModule,
    AuthModule,
    SpreadsheetsModule,
    TransactionsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
