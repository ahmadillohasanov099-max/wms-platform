import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { StatsAnalyticsService } from './services/stats-analytics.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService, StatsAnalyticsService],
  exports: [StatsService, StatsAnalyticsService],
})
export class StatsModule {}
