import { Module } from '@nestjs/common';
import { LimitsController } from './limits.controller';
import { LimitsService } from './limits.service';
import { PrismaModule } from '../../prisma';

@Module({
  imports: [PrismaModule],
  controllers: [LimitsController],
  providers: [LimitsService],
  exports: [LimitsService],
})
export class LimitsModule {}
