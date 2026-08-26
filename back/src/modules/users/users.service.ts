import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EmploymentStatus, OperationType, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma';
import { AuditService } from 'src/common/services/audit.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { t } from 'src/common';
import { EventsGateway } from '../events/events.gateway';
import { ActiveUser } from 'src/common/interfaces';
import { TelegramService } from '../nodemailer/telegram.service';
import {
  validateAndFormatPhone,
  validateAndFormatPassport,
  validateAndFormatPinfl,
} from 'src/common/helper/validation.helper';
import { enforceTenantOrgId } from 'src/common/helper/tenant.helper';
import { UsersExcelService } from './services/users-excel.service';
import { UsersOffboardingService } from './services/users-offboarding.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private eventsGateway: EventsGateway,
    private telegramService: TelegramService,
    private excelService: UsersExcelService,
    private offboardingService: UsersOffboardingService,
  ) {}

  async findAll(query: UserQueryDto, currentUser?: ActiveUser) {
    const { page = 1, limit = 20, search, departmentId, role, employmentStatus, organizationId } = query;
    const skip = (page - 1) * limit;

    const resolvedOrgId = enforceTenantOrgId(currentUser, organizationId);
    const orgFilter: any = resolvedOrgId ? { organizationId: resolvedOrgId } : {};

    const where: any = {
      deletedAt: null,
      ...orgFilter,
      role: role ? role : UserRole.XODIM,
      ...(employmentStatus && { employmentStatus }),
      ...(departmentId && { departmentId }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { position: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          username: true,
          role: true,
          employmentStatus: true,
          isActive: true,
          phone: true,
          internalPhone: true,
          position: true,
          passport: true,
          pinfl: true,
          address: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
          offboardingStartedAt: true,
          offboardingStartedBy: { select: { id: true, fullName: true, username: true } },
          warehouseApprovedAt: true,
          warehouseApprovedBy: { select: { id: true, fullName: true, username: true } },
          offboardingCompletedAt: true,
          offboardingCompletedBy: { select: { id: true, fullName: true, username: true } },
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        employmentStatus: true,
        isActive: true,
        phone: true,
        internalPhone: true,
        position: true,
        passport: true,
        pinfl: true,
        address: true,
        organizationId: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        ledDepartments: { select: { id: true, name: true } },
        offboardingStartedAt: true,
        offboardingStartedBy: { select: { id: true, fullName: true, username: true } },
        warehouseApprovedAt: true,
        warehouseApprovedBy: { select: { id: true, fullName: true, username: true } },
        offboardingCompletedAt: true,
        offboardingCompletedBy: { select: { id: true, fullName: true, username: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(t('errors.USER_NOT_FOUND', {}, 'Xodim topilmadi'));
    }

    return user;
  }

  async getAssignments(id: string) {
    await this.findOne(id);

    return this.prisma.assignment.findMany({
      where: {
        userId: id,
        returnedAt: null,
      },
      include: {
        department: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true } },
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
  }

  async getHistory(id: string) {
    await this.findOne(id);

    return this.prisma.operation.findMany({
      where: {
        OR: [{ userId: id }, { fromUserId: id }, { performedById: id }],
      },
      include: {
        product: { select: { id: true, name: true } },
        asset: { select: { id: true, inventoryNumber: true } },
        department: { select: { id: true, name: true } },
        performedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateUserDto, createdBy: string) {
    const creatorUser = await this.prisma.user.findUnique({
      where: { id: createdBy },
      select: { id: true, role: true, organizationId: true },
    });

    const isSuperOrMinistry =
      creatorUser?.role === UserRole.SUPER_ADMIN ||
      creatorUser?.role === UserRole.VAZIRLIK_OMBORCHI;

    if (!isSuperOrMinistry) {
      if (dto.role === UserRole.SUPER_ADMIN || dto.role === UserRole.VAZIRLIK_OMBORCHI) {
        throw new BadRequestException("Siz ushbu rolni tayinlash huquqiga ega emassiz");
      }
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw new BadRequestException(t('errors.ALREADY_EXISTS', {}, 'Bu username allaqachon mavjud'));
    }

    let department: any = null;
    if (dto.departmentId) {
      department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, deletedAt: null },
      });

      if (!department) {
        throw new BadRequestException("Bo'lim topilmadi");
      }

      if (!isSuperOrMinistry && creatorUser?.organizationId && department.organizationId && department.organizationId !== creatorUser.organizationId) {
        throw new BadRequestException("Ushbu bo'lim sizning tashkilotingizga tegishli emas");
      }
    }

    // Format and Validate phone, passport, pinfl
    const formattedPhone = validateAndFormatPhone(dto.phone);
    const formattedPassport = validateAndFormatPassport(dto.passport);
    const formattedPinfl = validateAndFormatPinfl(dto.pinfl);

    if (formattedPhone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: formattedPhone, deletedAt: null },
      });
      if (existingPhone) {
        throw new BadRequestException(
          `"${formattedPhone}" telefon raqami boshqa xodim (${existingPhone.fullName}) ga biriktirilgan`,
        );
      }
    }

    if (formattedPassport) {
      const existingPassport = await this.prisma.user.findFirst({
        where: { passport: formattedPassport, deletedAt: null },
      });
      if (existingPassport) {
        throw new BadRequestException(
          `"${formattedPassport}" pasport ma'lumotlari boshqa xodim (${existingPassport.fullName}) ga biriktirilgan`,
        );
      }
    }

    if (formattedPinfl) {
      const existingPinfl = await this.prisma.user.findFirst({
        where: { pinfl: formattedPinfl, deletedAt: null },
      });
      if (existingPinfl) {
        throw new BadRequestException(
          `"${formattedPinfl}" JSHSHIR (PINFL) raqami boshqa xodim (${existingPinfl.fullName}) ga biriktirilgan`,
        );
      }
    }

    const { password, departmentId, organizationId, phone, passport, pinfl, ...rest } = dto;
    const passwordHash = await bcrypt.hash(password, 10);

    const targetOrgId = isSuperOrMinistry && organizationId
      ? organizationId
      : (creatorUser?.organizationId || null);

    const user = await this.prisma.user.create({
      data: {
        ...rest,
        phone: formattedPhone || null,
        passport: formattedPassport || null,
        pinfl: formattedPinfl || null,
        departmentId: department ? department.id : null,
        passwordHash,
        organizationId: targetOrgId,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
        phone: true,
        internalPhone: true,
        position: true,
        passport: true,
        pinfl: true,
        address: true,
        departmentId: true,
        createdAt: true,
      },
    });

    await this.auditService.log({
      userId: createdBy,
      action: AuditAction.CREATE,
      tableName: 'User',
      recordId: user.id,
      newData: user,
    });

    void this.telegramService.sendAdminNewUserAlert(
      user.fullName,
      user.position || user.role,
      department?.name || "Tizim ma'muri (Bo'limsiz)",
    );

    return user;
  }

  async update(id: string, dto: UpdateUserDto, updatedBy: string) {
    const updaterUser = await this.prisma.user.findUnique({
      where: { id: updatedBy },
      select: { id: true, role: true, organizationId: true },
    });

    const isSuperOrMinistry =
      updaterUser?.role === UserRole.SUPER_ADMIN ||
      updaterUser?.role === UserRole.VAZIRLIK_OMBORCHI;

    const oldUser = await this.findOne(id);

    if (!isSuperOrMinistry && updaterUser?.organizationId) {
      if (oldUser.organizationId && oldUser.organizationId !== updaterUser.organizationId) {
        throw new BadRequestException("Siz boshqa tashkilot xodimini tahrirlay olmaysiz");
      }
      if (dto.role === UserRole.SUPER_ADMIN || dto.role === UserRole.VAZIRLIK_OMBORCHI) {
        throw new BadRequestException("Siz ushbu rolni tayinlash huquqiga ega emassiz");
      }
    }

    if (dto.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(t('errors.ALREADY_EXISTS', {}, 'Bu username allaqachon mavjud'));
      }
    }

    // Format and Validate phone, passport, pinfl on update
    const formattedPhone = dto.phone !== undefined ? validateAndFormatPhone(dto.phone) : undefined;
    const formattedPassport = dto.passport !== undefined ? validateAndFormatPassport(dto.passport) : undefined;
    const formattedPinfl = dto.pinfl !== undefined ? validateAndFormatPinfl(dto.pinfl) : undefined;

    if (formattedPhone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: formattedPhone, deletedAt: null, id: { not: id } },
      });
      if (existingPhone) {
        throw new BadRequestException(
          `"${formattedPhone}" telefon raqami boshqa xodim (${existingPhone.fullName}) ga biriktirilgan`,
        );
      }
    }

    if (formattedPassport) {
      const existingPassport = await this.prisma.user.findFirst({
        where: { passport: formattedPassport, deletedAt: null, id: { not: id } },
      });
      if (existingPassport) {
        throw new BadRequestException(
          `"${formattedPassport}" pasport ma'lumotlari boshqa xodim (${existingPassport.fullName}) ga biriktirilgan`,
        );
      }
    }

    if (formattedPinfl) {
      const existingPinfl = await this.prisma.user.findFirst({
        where: { pinfl: formattedPinfl, deletedAt: null, id: { not: id } },
      });
      if (existingPinfl) {
        throw new BadRequestException(
          `"${formattedPinfl}" JSHSHIR (PINFL) raqami boshqa xodim (${existingPinfl.fullName}) ga biriktirilgan`,
        );
      }
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, deletedAt: null },
      });

      if (!department) {
        throw new BadRequestException("Bo'lim topilmadi");
      }
    }

    const { departmentId, phone, passport, pinfl, ...restDto } = dto;
    const updateData: any = { ...restDto };
    if (departmentId !== undefined) {
      updateData.departmentId = departmentId ? departmentId : null;
    }
    if (phone !== undefined) updateData.phone = formattedPhone || null;
    if (passport !== undefined) updateData.passport = formattedPassport || null;
    if (pinfl !== undefined) updateData.pinfl = formattedPinfl || null;

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
        phone: true,
        internalPhone: true,
        position: true,
        passport: true,
        pinfl: true,
        address: true,
        departmentId: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      userId: updatedBy,
      action: AuditAction.UPDATE,
      tableName: 'User',
      recordId: id,
      oldData: oldUser,
      newData: updatedUser,
    });

    return updatedUser;
  }

  async toggleStatus(id: string, updatedBy: string) {
    const user = await this.findOne(id);
    const newStatus = !user.isActive;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { isActive: newStatus },
        select: {
          id: true,
          fullName: true,
          username: true,
          isActive: true,
        },
      });

      if (!newStatus) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: updatedBy,
          action: 'UPDATE_USER_STATUS',
          resource: 'User',
          resourceId: id,
          method: 'PATCH',
          endpoint: `/users/${id}/status`,
          oldData: { isActive: user.isActive },
          newData: { isActive: updated.isActive },
        },
      });

      return updated;
    });
  }

  async remove(id: string, deletedBy: string) {
    const deleterUser = await this.prisma.user.findUnique({
      where: { id: deletedBy },
      select: { id: true, role: true, organizationId: true },
    });

    const isSuperOrMinistry =
      deleterUser?.role === 'SUPER_ADMIN' ||
      deleterUser?.role === 'VAZIRLIK_OMBORCHI';

    const targetUser = await this.findOne(id);

    if (!isSuperOrMinistry && deleterUser?.organizationId && targetUser.organizationId && targetUser.organizationId !== deleterUser.organizationId) {
      throw new ForbiddenException("Siz faqat o'z tashkilotingiz xodimlarini boshqara olasiz");
    }

    const activeAssignments = await this.prisma.assignment.count({
      where: { userId: id, returnedAt: null },
    });

    if (activeAssignments > 0) {
      throw new BadRequestException(
        'Xodimda qaytarilmagan jihozlar bor, oldin ularni qaytarib oling!',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          userId: deletedBy,
          action: 'DELETE_USER',
          resource: 'User',
          resourceId: id,
          method: 'DELETE',
          endpoint: `/users/${id}`,
        },
      });

      return { message: "Xodim muvaffaqiyatli o'chirildi" };
    });
  }

  async bulkReturn(id: string, performedById: string) {
    await this.findOne(id);

    const assignments = await this.prisma.assignment.findMany({
      where: { userId: id, returnedAt: null },
      include: { asset: true },
    });

    if (assignments.length === 0) {
      throw new BadRequestException("Xodimda jihozlar yo'q");
    }

    return this.prisma.$transaction(async (tx) => {
      for (const assignment of assignments) {
        await tx.assignment.update({
          where: { id: assignment.id },
          data: { returnedAt: new Date() },
        });

        await tx.inventory.update({
          where: { productId: assignment.asset.productId },
          data: { quantity: { increment: 1 } },
        });

        await tx.operation.create({
          data: {
            type: 'RETURN_FROM_USER',
            quantity: 1,
            userId: id,
            assetId: assignment.assetId,
            productId: assignment.asset.productId,
            performedById,
            note: 'Ommaviy qaytarish',
          },
        });
      }

      return {
        message: `${assignments.length} ta jihoz muvaffaqiyatli qaytarildi`,
        count: assignments.length,
      };
    });
  }

  async bulkTransfer(id: string, toUserId: string, performedById: string) {
    await this.findOne(id);

    const toUser = await this.prisma.user.findFirst({
      where: { id: toUserId, deletedAt: null },
    });
    if (!toUser) throw new NotFoundException('Xodim topilmadi');

    if (id === toUserId) {
      throw new BadRequestException("Bir xil xodimga o'tkazib bo'lmaydi");
    }

    const assignments = await this.prisma.assignment.findMany({
      where: { userId: id, returnedAt: null },
      include: { asset: true },
    });

    if (assignments.length === 0) {
      throw new BadRequestException("Xodimda jihozlar yo'q");
    }

    return this.prisma.$transaction(async (tx) => {
      for (const assignment of assignments) {
        await tx.assignment.update({
          where: { id: assignment.id },
          data: { returnedAt: new Date() },
        });

        await tx.assignment.create({
          data: { userId: toUserId, assetId: assignment.assetId },
        });

        await tx.operation.create({
          data: {
            type: 'TRANSFER_USER',
            quantity: 1,
            userId: toUserId,
            fromUserId: id,
            assetId: assignment.assetId,
            productId: assignment.asset.productId,
            performedById,
            note: "Ommaviy o'tkazish",
          },
        });
      }

      return {
        message: `${assignments.length} ta jihoz muvaffaqiyatli o'tkazildi`,
        count: assignments.length,
      };
    });
  }

  async exportExcel(query: UserQueryDto, currentUser?: ActiveUser) {
    return this.excelService.exportExcel(query, currentUser);
  }

  async exportCsv(query: UserQueryDto, currentUser?: ActiveUser) {
    return this.excelService.exportExcel(query, currentUser);
  }

  async importExcel(fileBuffer: Buffer, performedById: string) {
    return this.excelService.importExcel(fileBuffer, performedById);
  }

  async startOffboarding(userId: string, performedById: string) {
    return this.offboardingService.startOffboarding(userId, performedById);
  }

  async getPendingOffboardings() {
    return this.offboardingService.getPendingOffboardings();
  }

  async warehouseApproveOffboarding(userId: string, performedById: string) {
    return this.offboardingService.warehouseApproveOffboarding(userId, performedById);
  }

  async completeOffboarding(userId: string, performedById: string) {
    return this.offboardingService.completeOffboarding(userId, performedById);
  }

  async getOffboardingAkt(userId: string) {
    return this.offboardingService.getOffboardingAkt(userId);
  }
}
