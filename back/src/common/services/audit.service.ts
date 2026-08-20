import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma';

function sanitizeNullBytes(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return val.replace(/\0/g, '').replace(/\\u0000/g, '');
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeNullBytes);
  }
  if (typeof val === 'object') {
    const res: any = {};
    for (const key of Object.keys(val)) {
      res[key] = sanitizeNullBytes(val[key]);
    }
    return res;
  }
  return val;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log({
    userId,
    action,
    tableName,
    recordId,
    oldData,
    newData,
    ipAddress,
    userAgent,
  }: {
    userId: string;
    action: any;
    tableName: string;
    recordId: string;
    oldData?: any;
    newData?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: String(action || 'ACTION'),
          resource: tableName ? sanitizeNullBytes(tableName) : undefined,
          resourceId: recordId,
          method: 'INTERNAL',
          endpoint: `/internal/${(tableName || 'unknown').toLowerCase()}`,
          oldData: oldData ? sanitizeNullBytes(oldData) : undefined,
          newData: newData ? sanitizeNullBytes(newData) : undefined,
          ipAddress,
          userAgent: userAgent ? sanitizeNullBytes(userAgent) : undefined,
        },
      });
    } catch (error) {
      this.logger.warn(`Internal AuditLog yozishda xatolik: ${error?.message}`);
    }
  }
}
