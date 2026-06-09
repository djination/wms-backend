import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AccessManagementModule } from './modules/access-management/access-management.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { HealthModule } from './modules/health/health.module';
import { ImportConsignmentModule } from './modules/import-consignment/import-consignment.module';
import { InboundModule } from './modules/inbound/inbound.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { KpiModule } from './modules/kpi/kpi.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { OutboundModule } from './modules/outbound/outbound.module';
import { ProcessFlowModule } from './modules/process-flow/process-flow.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { StorageModule } from './modules/storage/storage.module';
import { UploadModule } from './modules/upload/upload.module';
import { validationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '..', '.env'), join(__dirname, '..', '.env.local')],
      validationSchema,
    }),
    PrismaModule,
    RedisModule,
    MessagingModule,
    StorageModule,
    AccessManagementModule,
    BillingModule,
    AuthModule,
    HealthModule,
    UploadModule,
    IntegrationModule,
    MasterDataModule,
    ImportConsignmentModule,
    InboundModule,
    OutboundModule,
    ProcessFlowModule,
    KpiModule,
  ],
})
export class AppModule {}
