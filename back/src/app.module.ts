import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { PrismaModule } from 'src/prisma';
import { CommonModule } from './common';
import { AuthModule } from './modules/auth';
import { DepartmentsModule } from './modules/departments';
import { UsersModule } from './modules/users';
import { ProductsModule } from './modules/products';
import { HistoryModule } from './modules/history';
import { InventoryModule } from './modules/inventory';
import { OperationsModule } from './modules/operations';
import { StatsModule } from './modules/stats';
import { MailModule } from './modules/nodemailer';
import { EventsModule } from './modules/events';
import { OrganizationsModule } from './modules/organizations';
import { RequestsModule } from './modules/requests';
import { AuditModule, AuditInterceptor } from './modules/audit';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 30, // Max 30 req / sec
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 150, // Max 150 req / 10 sec
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 500, // Max 500 req / min
      },
    ]),
    I18nModule.forRoot({
      fallbackLanguage: 'uz',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        new QueryResolver(['lang', 'l']),
        new HeaderResolver(['x-custom-lang']),
        AcceptLanguageResolver,
      ],
    }),
    PrismaModule,
    EventsModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    RequestsModule,
    CommonModule,
    DepartmentsModule,
    UsersModule,
    ProductsModule,
    HistoryModule,
    InventoryModule,
    OperationsModule,
    StatsModule,
    MailModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
