import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from 'src/prisma';
import { AuditService } from 'src/common/services/audit.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto';
import { t } from 'src/common';
import { enforceTenantOrgId } from 'src/common/helper/tenant.helper';
import { DepartmentsExcelService } from './services/departments-excel.service';

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private excelService: DepartmentsExcelService,
  ) {}

  async findAll(targetOrgId?: string, currentUser?: any) {
    const resolvedOrgId = enforceTenantOrgId(currentUser, targetOrgId);
    const orgFilter: any = resolvedOrgId ? { organizationId: resolvedOrgId } : {};

    return this.prisma.department.findMany({
      where: {
        deletedAt: null,
        ...orgFilter,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        leader: {
          select: {
            id: true,
            fullName: true,
            username: true,
            position: true,
            phone: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
      include: {
        leader: {
          select: {
            id: true,
            fullName: true,
            username: true,
            position: true,
            phone: true,
          },
        },
        users: {
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            fullName: true,
            username: true,
            phone: true,
            internalPhone: true,
            position: true,
          },
        },
        departmentAssets: {
          include: {
            product: {
              select: { id: true, name: true, productType: true, unit: true },
            },
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(t('errors.DEPARTMENT_NOT_FOUND', {}, "Bo'lim topilmadi"));
    }

    const assignments = await this.prisma.assignment.findMany({
      where: {
        returnedAt: null,
        departmentId: id,
      },
      include: {
        user: { select: { id: true, fullName: true } },
        department: { select: { id: true, name: true } },
        asset: {
          include: {
            product: {
              select: { id: true, name: true, productType: true },
            },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const operations = await this.prisma.operation.findMany({
      where: {
        departmentId: id,
      },
      include: {
        product: { select: { id: true, name: true, unit: true, productType: true } },
        asset: { select: { id: true, inventoryNumber: true, serialNumber: true } },
        performedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...department,
      assignments,
      operations,
    };
  }

  async getStats(id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
    });

    if (!department) {
      throw new NotFoundException(t('errors.DEPARTMENT_NOT_FOUND', {}, "Bo'lim topilmadi"));
    }

    const [userCount, assetCount, sarflanadiganAgg, giveToDeptAgg] = await Promise.all([
      this.prisma.user.count({
        where: { departmentId: id, deletedAt: null, isActive: true },
      }),
      this.prisma.assignment.count({
        where: {
          returnedAt: null,
          departmentId: id,
        },
      }),
      this.prisma.departmentAsset.aggregate({
        where: {
          departmentId: id,
          product: { productType: 'SARFLANADIGAN', deletedAt: null },
        },
        _sum: { quantity: true },
      }),
      this.prisma.operation.aggregate({
        where: {
          departmentId: id,
          type: 'GIVE_TO_DEPT',
        },
        _sum: { quantity: true },
      }),
    ]);

    const totalSarflanadigan = Math.max(
      sarflanadiganAgg._sum.quantity ?? 0,
      giveToDeptAgg._sum.quantity ?? 0,
    );

    return {
      id: department.id,
      name: department.name,
      userCount,
      assetCount,
      sarflanadigan: totalSarflanadigan,
    };
  }

  async create(dto: CreateDepartmentDto, createdBy: string) {
    const creatorUser = await this.prisma.user.findUnique({
      where: { id: createdBy },
      select: { role: true, organizationId: true },
    });

    const isSuperOrMinistry =
      creatorUser?.role === 'SUPER_ADMIN' ||
      creatorUser?.role === 'VAZIRLIK_OMBORCHI';

    const orgId = isSuperOrMinistry && dto.organizationId
      ? dto.organizationId
      : (creatorUser?.organizationId || null);

    const existing = await this.prisma.department.findFirst({
      where: { name: dto.name, organizationId: orgId, deletedAt: null },
    });

    if (existing) {
      throw new BadRequestException(t('errors.DEPT_EXISTS', {}, "Bu nomdagi bo'lim allaqachon mavjud"));
    }

    const { organizationId, leaderId, ...restDto } = dto;

    if (leaderId) {
      const leaderUser = await this.prisma.user.findFirst({
        where: { id: leaderId, deletedAt: null, isActive: true },
      });
      if (!leaderUser) {
        throw new BadRequestException("Tanlangan bo'lim boshlig'i topilmadi");
      }
    }

    const department = await this.prisma.department.create({
      data: {
        ...restDto,
        leaderId: leaderId || null,
        organizationId: orgId,
      },
      include: {
        leader: {
          select: { id: true, fullName: true, username: true, position: true },
        },
      },
    });

    if (leaderId) {
      await this.prisma.user.update({
        where: { id: leaderId },
        data: { departmentId: department.id },
      });
    }

    await this.auditService.log({
      userId: createdBy,
      action: AuditAction.CREATE,
      tableName: 'Department',
      recordId: department.id,
      newData: department,
    });

    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto, updatedBy: string) {
    const updaterUser = await this.prisma.user.findUnique({
      where: { id: updatedBy },
      select: { id: true, role: true, organizationId: true },
    });

    const isSuperOrMinistry =
      updaterUser?.role === 'SUPER_ADMIN' ||
      updaterUser?.role === 'VAZIRLIK_OMBORCHI';

    const oldDepartment = await this.findOne(id);

    if (!isSuperOrMinistry && updaterUser?.organizationId) {
      if (oldDepartment.organizationId && oldDepartment.organizationId !== updaterUser.organizationId) {
        throw new BadRequestException("Siz boshqa tashkilot bo'limini tahrirlay olmaysiz");
      }
    }

    if (dto.name) {
      const existing = await this.prisma.department.findFirst({
        where: {
          name: dto.name,
          organizationId: oldDepartment.organizationId,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException(t('errors.DEPT_EXISTS', {}, "Bu nomdagi bo'lim allaqachon mavjud"));
      }
    }

    if (dto.leaderId) {
      const leaderUser = await this.prisma.user.findFirst({
        where: { id: dto.leaderId, deletedAt: null, isActive: true },
      });
      if (!leaderUser) {
        throw new BadRequestException("Tanlangan bo'lim boshlig'i topilmadi");
      }
      if (leaderUser.departmentId !== id) {
        await this.prisma.user.update({
          where: { id: leaderUser.id },
          data: { departmentId: id },
        });
      }
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        ...dto,
        description: dto.description !== undefined ? (dto.description && dto.description.trim() !== '' ? dto.description.trim() : null) : undefined,
        leaderId: dto.leaderId !== undefined ? (dto.leaderId && dto.leaderId.trim() !== '' ? dto.leaderId : null) : undefined,
      },
      include: {
        leader: {
          select: { id: true, fullName: true, username: true, position: true },
        },
      },
    });

    await this.auditService.log({
      userId: updatedBy,
      action: AuditAction.UPDATE,
      tableName: 'Department',
      recordId: id,
      oldData: oldDepartment,
      newData: updated,
    });

    return updated;
  }

  async remove(id: string, deletedBy: string) {
    const deleterUser = await this.prisma.user.findUnique({
      where: { id: deletedBy },
      select: { id: true, role: true, organizationId: true },
    });

    const isSuperOrMinistry =
      deleterUser?.role === 'SUPER_ADMIN' ||
      deleterUser?.role === 'VAZIRLIK_OMBORCHI';

    const oldDepartment = await this.findOne(id);

    if (!isSuperOrMinistry && deleterUser?.organizationId && oldDepartment.organizationId && oldDepartment.organizationId !== deleterUser.organizationId) {
      throw new ForbiddenException("Siz faqat o'z tashkilotingiz bo'limlarini boshqara olasiz");
    }

    const userCount = await this.prisma.user.count({
      where: { departmentId: id, deletedAt: null },
    });


    if (userCount > 0) {
      throw new BadRequestException(
        t('errors.DEPT_HAS_USERS', {}, "Bo'limda xodimlar mavjud, o'chirib bo'lmaydi"),
      );
    }

    // FIX: Only block deletion if there are active assets (quantity > 0)
    const assetCount = await this.prisma.departmentAsset.count({
      where: {
        departmentId: id,
        quantity: { gt: 0 },
      },
    });

    if (assetCount > 0) {
      throw new BadRequestException(
        t('errors.DEPT_HAS_ASSETS', {}, "Bo'limda jihozlar mavjud, o'chirib bo'lmaydi"),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.department.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          userId: deletedBy,
          action: 'DELETE_DEPARTMENT',
          resource: 'Department',
          resourceId: id,
          method: 'DELETE',
          endpoint: `/departments/${id}`,
        },
      });

      return { message: "Bo'lim muvaffaqiyatli o'chirildi" };
    });
  }

  async exportCsv(organizationId?: string) {
    return this.excelService.exportCsv(organizationId);
  }
}
