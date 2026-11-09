import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from 'src/prisma';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({
    summary: 'Tizim salomatligi va holatini tekshirish (Health Check)',
    description:
      'Maʼlumotlar bazasi aloqasi, xotira sarfi, uptime va tizim parametrlarini tekshiradi',
  })
  @ApiResponse({ status: 200, description: 'Tizim to‘liq barqaror holatda' })
  @ApiResponse({ status: 503, description: 'Tizimda uzilish mavjud (masalan, DB uzilgan)' })
  @Get()
  async checkHealth(@Res() res: Response) {
    const startTime = Date.now();
    let dbStatus: 'up' | 'down' = 'down';
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;

    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
      dbStatus = 'up';
    } catch (err: any) {
      dbStatus = 'down';
      dbError = err?.message || 'Database connection error';
    }

    const memory = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());

    const formatUptime = (secs: number) => {
      const d = Math.floor(secs / (3600 * 24));
      const h = Math.floor((secs % (3600 * 24)) / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = Math.floor(secs % 60);
      const parts: string[] = [];
      if (d > 0) parts.push(`${d}d`);
      if (h > 0) parts.push(`${h}h`);
      if (m > 0) parts.push(`${m}m`);
      parts.push(`${s}s`);
      return parts.join(' ');
    };

    const isHealthy = dbStatus === 'up';
    const statusCode = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startTime,
      uptime: formatUptime(uptimeSeconds),
      uptimeSeconds,
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        ...(dbError ? { error: dbError } : {}),
      },
      memory: {
        rssMB: +(memory.rss / (1024 * 1024)).toFixed(2),
        heapUsedMB: +(memory.heapUsed / (1024 * 1024)).toFixed(2),
        heapTotalMB: +(memory.heapTotal / (1024 * 1024)).toFixed(2),
        externalMB: +(memory.external / (1024 * 1024)).toFixed(2),
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        environment: process.env.NODE_ENV || 'development',
      },
    });
  }
}
