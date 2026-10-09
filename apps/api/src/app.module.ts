import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { GoogleSheetsModule } from './modules/google-sheets/google-sheets.module';
import { HealthModule } from './modules/health/health.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { PlanningModule } from './modules/planning/planning.module';
import { RecurringModule } from './modules/recurring/recurring.module';
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
    CategoriesModule,
    RecurringModule,
    InvestmentsModule,
    AnalyticsModule,
    PlanningModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
