import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger('PrismaService');

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();

    // Slow Query Monitoring: Log any query exceeding 100ms
    // @ts-ignore
    this.$on('query', (e: any) => {
      if (e.duration >= 100) {
        this.logger.warn(
          `[SLOW QUERY] ${e.duration}ms: ${e.query} -- Params: ${e.params}`,
        );
      }
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
