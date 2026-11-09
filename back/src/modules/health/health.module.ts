import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from 'src/prisma';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
