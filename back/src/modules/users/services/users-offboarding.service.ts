import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EmploymentStatus, OperationType } from '@prisma/client';
import { PrismaService } from 'src/prisma';
import { AuditService } from 'src/common/services/audit.service';
import { EventsGateway } from '../../events/events.gateway';

@Injectable()
export class UsersOffboardingService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private eventsGateway: EventsGateway,
  ) {}

  async startOffboarding(userId: string, performedById: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException("Xodim topilmadi");
    }

    if (user.employmentStatus !== EmploymentStatus.ACTIVE) {
      throw new BadRequestException("Xodim allaqachon ishdan bo'shash jarayonida yoki bo'shatilgan");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        employmentStatus: EmploymentStatus.OFFBOARDING_PENDING,
        offboardingStartedAt: new Date(),
        offboardingStartedById: performedById,
      },
      include: {
        department: { select: { id: true, name: true } },
        offboardingStartedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    await this.auditService.log({
      userId: performedById,
      action: AuditAction.UPDATE,
      tableName: 'User',
      recordId: userId,
      oldData: { employmentStatus: user.employmentStatus },
      newData: { employmentStatus: EmploymentStatus.OFFBOARDING_PENDING },
    });

    this.eventsGateway.broadcastOffboardingStarted(updatedUser);

    return {
      success: true,
      message: `${updatedUser.fullName} uchun ishdan bo'shash jarayoni boshlandi. Omborchi tasdiqlashi kutilmoqda.`,
      user: updatedUser,
    };
  }

  async getPendingOffboardings() {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        employmentStatus: EmploymentStatus.OFFBOARDING_PENDING,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        position: true,
        phone: true,
        employmentStatus: true,
        department: { select: { id: true, name: true } },
        offboardingStartedAt: true,
        offboardingStartedBy: { select: { id: true, fullName: true, username: true } },
        warehouseApprovedAt: true,
        warehouseApprovedBy: { select: { id: true, fullName: true, username: true } },
        assignments: {
          where: { returnedAt: null },
          include: {
            asset: {
              include: {
                product: { select: { id: true, name: true, productType: true } },
              },
            },
          },
        },
      },
      orderBy: { offboardingStartedAt: 'desc' },
    });

    return users.map((u) => ({
      ...u,
      unreturnedAssetsCount: u.assignments.length,
    }));
  }

  async warehouseApproveOffboarding(userId: string, performedById: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException("Xodim topilmadi");
    }

    if (user.employmentStatus !== EmploymentStatus.OFFBOARDING_PENDING) {
      throw new BadRequestException("Xodim ishdan bo'shash jarayonida emas");
    }

    const activeAssignments = await this.prisma.assignment.findMany({
      where: { userId, returnedAt: null },
      include: { asset: true },
    });

    const now = new Date();
    for (const assignment of activeAssignments) {
      await this.prisma.operation.create({
        data: {
          type: OperationType.RETURN_FROM_USER,
          quantity: 1,
          productId: assignment.asset.productId,
          assetId: assignment.assetId,
          userId: userId,
          performedById: performedById,
          note: "Ishdan bo'shatish jarayonida omborchiga topshirildi",
        },
      });

      await this.prisma.assignment.update({
        where: { id: assignment.id },
        data: { returnedAt: now },
      });

      await this.prisma.inventory.updateMany({
        where: { productId: assignment.asset.productId },
        data: { quantity: { increment: 1 } },
      });
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        warehouseApprovedAt: now,
        warehouseApprovedById: performedById,
      },
      include: {
        warehouseApprovedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    await this.auditService.log({
      userId: performedById,
      action: AuditAction.UPDATE,
      tableName: 'User',
      recordId: userId,
      newData: { warehouseApprovedAt: now, warehouseApprovedById: performedById },
    });

    this.eventsGateway.broadcastWarehouseApproved(updatedUser);

    return {
      success: true,
      message: `${updatedUser.fullName} ning barcha jihozlari omborchi tomonidan qabul qilindi va tasdiqlandi.`,
      user: updatedUser,
    };
  }

  async completeOffboarding(userId: string, performedById: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException("Xodim topilmadi");
    }

    if (user.employmentStatus !== EmploymentStatus.OFFBOARDING_PENDING) {
      throw new BadRequestException("Xodim ishdan bo'shash jarayonida emas");
    }

    if (!user.warehouseApprovedAt) {
      throw new BadRequestException("Omborchi barcha jihozlarni qabul qilib tasdiqlamagan!");
    }

    const activeAssignmentsCount = await this.prisma.assignment.count({
      where: { userId, returnedAt: null },
    });

    if (activeAssignmentsCount > 0) {
      throw new BadRequestException(`Xodim zimmasida hali ${activeAssignmentsCount} ta topshirilmagan jihoz bor`);
    }

    const now = new Date();
    const freedUsername = user.username.includes('_offboarded_')
      ? user.username
      : `${user.username}_offboarded_${Date.now()}`;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        employmentStatus: EmploymentStatus.OFFBOARDED,
        isActive: false,
        username: freedUsername,
        offboardingCompletedAt: now,
        offboardingCompletedById: performedById,
      },
      include: {
        offboardingCompletedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    await this.auditService.log({
      userId: performedById,
      action: AuditAction.UPDATE,
      tableName: 'User',
      recordId: userId,
      oldData: { employmentStatus: user.employmentStatus, isActive: true },
      newData: { employmentStatus: EmploymentStatus.OFFBOARDED, isActive: false },
    });

    this.eventsGateway.broadcastOffboardingCompleted(updatedUser);

    return {
      success: true,
      message: `${user.fullName} rasman ishdan bo'shatildi! Username keyingi xodimlar uchun bo'shatildi.`,
      user: updatedUser,
    };
  }

  async getOffboardingAkt(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      include: {
        department: { select: { id: true, name: true } },
        offboardingStartedBy: { select: { id: true, fullName: true, position: true } },
        warehouseApprovedBy: { select: { id: true, fullName: true, position: true } },
        offboardingCompletedBy: { select: { id: true, fullName: true, position: true } },
      },
    });

    if (!user) {
      throw new NotFoundException("Xodim topilmadi");
    }

    const returnedOperations = await this.prisma.operation.findMany({
      where: {
        userId,
        type: OperationType.RETURN_FROM_USER,
      },
      include: {
        product: { select: { name: true, unit: true } },
        asset: { select: { inventoryNumber: true, serialNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const docNumber = `AKT-${new Date().getFullYear()}-${userId.slice(0, 6).toUpperCase()}`;

    return {
      documentNumber: docNumber,
      documentDate: user.offboardingCompletedAt || user.warehouseApprovedAt || new Date(),
      employee: {
        id: user.id,
        fullName: user.fullName,
        position: user.position || "Xodim",
        departmentName: user.department?.name || "Bo'limsiz",
      },
      warehouseManager: {
        fullName: user.warehouseApprovedBy?.fullName || "Bosh Omborchi",
        position: user.warehouseApprovedBy?.position || "Omborchi",
      },
      hrManager: {
        fullName: user.offboardingStartedBy?.fullName || user.offboardingCompletedBy?.fullName || "HR Menejer",
        position: user.offboardingStartedBy?.position || user.offboardingCompletedBy?.position || "Kadrlar Bo'limi",
      },
      returnedAssets: returnedOperations.map((op, idx) => ({
        index: idx + 1,
        productName: op.product?.name || "Noma'lum mahsulot",
        inventoryNumber: op.asset?.inventoryNumber || "-",
        serialNumber: op.asset?.serialNumber || "-",
        returnedAt: op.createdAt,
      })),
    };
  }
}
