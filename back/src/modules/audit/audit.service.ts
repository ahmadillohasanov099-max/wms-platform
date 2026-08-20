import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { FindAuditLogDto } from './dto/find-audit-log.dto';

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

  async findOne(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, username: true, role: true, phone: true, position: true } },
        organization: { select: { id: true, name: true, code: true, type: true } },
      },
    });

    if (!log) {
      throw new NotFoundException("Audit log topilmadi");
    }

    return log;
  }

  async create(dto: CreateAuditLogDto) {
    try {
      const sanitizedPayload = dto.payload ? sanitizeNullBytes(dto.payload) : undefined;
      const sanitizedOldData = dto.oldData ? sanitizeNullBytes(dto.oldData) : undefined;
      const sanitizedNewData = dto.newData ? sanitizeNullBytes(dto.newData) : undefined;

      return await this.prisma.auditLog.create({
        data: {
          organizationId: dto.organizationId,
          userId: dto.userId,
          userName: dto.userName ? sanitizeNullBytes(dto.userName) : undefined,
          userRole: dto.userRole,
          action: dto.action,
          resource: dto.resource ? sanitizeNullBytes(dto.resource) : undefined,
          resourceId: dto.resourceId,
          method: dto.method,
          endpoint: dto.endpoint ? sanitizeNullBytes(dto.endpoint) : undefined,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent ? sanitizeNullBytes(dto.userAgent) : undefined,
          statusCode: dto.statusCode ?? 200,
          durationMs: dto.durationMs,
          payload: sanitizedPayload ? JSON.parse(JSON.stringify(sanitizedPayload)) : undefined,
          oldData: sanitizedOldData ? JSON.parse(JSON.stringify(sanitizedOldData)) : undefined,
          newData: sanitizedNewData ? JSON.parse(JSON.stringify(sanitizedNewData)) : undefined,
        },
      });
    } catch (error) {
      this.logger.error(`AuditLog yozishda xatolik yuz berdi: ${error?.message}`, error?.stack);
      return null;
    }
  }

  async findAll(query: FindAuditLogDto, currentUserOrgId?: string, isSuperAdmin: boolean = false) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (!isSuperAdmin && currentUserOrgId) {
      where.organizationId = currentUserOrgId;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.resource) {
      where.resource = query.resource;
    }

    if (query.method) {
      where.method = query.method;
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { userName: { contains: s, mode: 'insensitive' } },
        { endpoint: { contains: s, mode: 'insensitive' } },
        { action: { contains: s, mode: 'insensitive' } },
        { ipAddress: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, username: true, role: true } },
          organization: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getStats(currentUserOrgId?: string, isSuperAdmin: boolean = false) {
    const where: any = {};
    if (!isSuperAdmin && currentUserOrgId) {
      where.organizationId = currentUserOrgId;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalLogs, todayLogs, deleteCount, activeUsers] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.count({
        where: { ...where, createdAt: { gte: todayStart } },
      }),
      this.prisma.auditLog.count({
        where: { ...where, method: 'DELETE' },
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { ...where, userId: { not: null } },
      }),
    ]);

    return {
      totalLogs,
      todayLogs,
      deleteCount,
      activeUserCount: activeUsers.length,
    };
  }
}
