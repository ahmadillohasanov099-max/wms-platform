import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EmploymentStatus, OperationType, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma';
import { AuditService } from 'src/common/services/audit.service';
import { EventsGateway } from '../../events/events.gateway';
import { TelegramSenderService } from '../../nodemailer/services/telegram-sender.service';

@Injectable()
export class UsersOffboardingService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private eventsGateway: EventsGateway,
    private telegram: TelegramSenderService,
  ) {}

  async startOffboarding(userId: string, performedById: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException("Xodim topilmadi");
    }

    const performer = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { id: true, role: true, organizationId: true },
    });

    const isSuperAdmin = performer?.role === UserRole.SUPER_ADMIN;

    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.RAHBAR) {
      if (!isSuperAdmin) {
        throw new ForbiddenException("Super Admin yoki Rahbariyat hisobini ishdan bo'shatish taqiqlanadi!");
      }
    }

    if (!isSuperAdmin && performer?.organizationId && user.organizationId && user.organizationId !== performer.organizationId) {
      throw new ForbiddenException("Siz faqat o'z tashkilotingiz xodimlarini boshqara olasiz!");
    }

    if (performer?.role === UserRole.KADR && user.role !== UserRole.XODIM) {
      throw new ForbiddenException("Kadrlar bo'limi faqat oddiy 'Xodim' hisobini ishdan bo'shata oladi!");
    }

    if (user.employmentStatus !== EmploymentStatus.ACTIVE) {
      throw new BadRequestException("Xodim allaqachon ishdan bo'shash jarayonida yoki bo'shatilgan");
    }

    const activeAssignments = await this.prisma.assignment.findMany({
      where: { userId, returnedAt: null },
      include: {
        asset: {
          include: {
            product: { select: { id: true, name: true, productType: true } },
          },
        },
      },
    });

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

    try {
      await this.telegram.sendMessage(
        `📋 <b>Yangi ishdan bo'shash jarayoni (Offboarding) boshlandi:</b>\n\n` +
        `👤 <b>Xodim:</b> ${updatedUser.fullName} (@${updatedUser.username})\n` +
        `🏢 <b>Bo'lim:</b> ${updatedUser.department?.name || "Bo'limsiz"}\n` +
        `📦 <b>Topshirilishi kerak bo'lgan aktivlar:</b> ${activeAssignments.length} ta\n\n` +
        `⚠️ <i>Hurmatli omborchi, xodimga biriktirilgan moddiy aktivlarni qabul qilib, tizimda tasdiqlang!</i>`
      );
    } catch {}

    return {
      success: true,
      message: `${updatedUser.fullName} uchun ishdan bo'shash jarayoni boshlandi. Omborchi tasdiqlashi kutilmoqda.`,
      user: updatedUser,
      unreturnedAssetsCount: activeAssignments.length,
      activeAssignments,
    };
  }

  async cancelOffboarding(userId: string, performedById: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException("Xodim topilmadi");
    }

    const performer = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { id: true, role: true, organizationId: true },
    });

    const isSuperAdmin = performer?.role === UserRole.SUPER_ADMIN;

    if (!isSuperAdmin && performer?.organizationId && user.organizationId && user.organizationId !== performer.organizationId) {
      throw new ForbiddenException("Siz faqat o'z tashkilotingiz xodimlarini boshqara olasiz!");
    }

    if (performer?.role === UserRole.KADR && user.role !== UserRole.XODIM) {
      throw new ForbiddenException("Kadrlar bo'limi faqat oddiy 'Xodim' hisobini boshqara oladi!");
    }

    if (user.employmentStatus !== EmploymentStatus.OFFBOARDING_PENDING) {
      throw new BadRequestException("Ushbu xodim ishdan bo'shash jarayonida emas!");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        employmentStatus: EmploymentStatus.ACTIVE,
        offboardingStartedAt: null,
        offboardingStartedById: null,
        warehouseApprovedAt: null,
        warehouseApprovedById: null,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      userId: performedById,
      action: AuditAction.UPDATE,
      tableName: 'User',
      recordId: userId,
      oldData: { employmentStatus: EmploymentStatus.OFFBOARDING_PENDING },
      newData: { employmentStatus: EmploymentStatus.ACTIVE },
    });

    return {
      success: true,
      message: `${updatedUser.fullName} uchun ishdan bo'shash jarayoni bekor qilindi va faol holatga qaytarildi.`,
      user: updatedUser,
    };
  }

  async getPendingOffboardings(currentUser?: any) {
    const isGlobal =
      !currentUser ||
      currentUser.role === UserRole.SUPER_ADMIN ||
      currentUser.role === UserRole.VAZIRLIK_OMBORCHI;

    const orgFilter = isGlobal
      ? {}
      : currentUser?.organizationId
      ? { organizationId: currentUser.organizationId }
      : {};

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        employmentStatus: EmploymentStatus.OFFBOARDING_PENDING,
        ...orgFilter,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        position: true,
        phone: true,
        employmentStatus: true,
        organizationId: true,
        organization: { select: { id: true, name: true } },
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

    const performer = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { id: true, role: true, organizationId: true },
    });

    const isSuperAdmin = performer?.role === UserRole.SUPER_ADMIN;

    if (!isSuperAdmin && performer?.organizationId && user.organizationId && user.organizationId !== performer.organizationId) {
      throw new ForbiddenException("Siz faqat o'z tashkilotingiz xodimlarini tasdiqlay olasiz!");
    }

    if (user.employmentStatus !== EmploymentStatus.OFFBOARDING_PENDING) {
      throw new BadRequestException("Xodim ishdan bo'shash jarayonida emas");
    }

    const activeAssignments = await this.prisma.assignment.findMany({
      where: { userId, returnedAt: null },
      include: { asset: true },
    });

    const now = new Date();
    const docNumber = `AKT-${now.getFullYear()}-${userId.slice(0, 6).toUpperCase()}`;

    for (const assignment of activeAssignments) {
      await this.prisma.operation.create({
        data: {
          type: OperationType.RETURN_FROM_USER,
          quantity: 1,
          organizationId: user.organizationId,
          productId: assignment.asset.productId,
          assetId: assignment.assetId,
          userId: userId,
          performedById: performedById,
          documentNumber: docNumber,
          documentDate: now,
          note: `Ishdan bo'shatish jarayonida omborchiga topshirildi (${docNumber})`,
        },
      });

      await this.prisma.assignment.update({
        where: { id: assignment.id },
        data: { returnedAt: now },
      });

      await this.prisma.asset.update({
        where: { id: assignment.assetId },
        data: { status: 'ACTIVE' },
      });

      await this.prisma.inventory.updateMany({
        where: { productId: assignment.asset.productId },
        data: { quantity: { increment: 1 } },
      });
    }

    if (activeAssignments.length === 0) {
      const anyProduct =
        (await this.prisma.product.findFirst({
          where: { organizationId: user.organizationId },
        })) || (await this.prisma.product.findFirst());

      if (anyProduct) {
        await this.prisma.operation.create({
          data: {
            type: OperationType.RETURN_FROM_USER,
            quantity: 0,
            organizationId: user.organizationId,
            productId: anyProduct.id,
            userId: userId,
            performedById: performedById,
            documentNumber: docNumber,
            documentDate: now,
            note: `Ishdan bo'shatish jarayoni: Xodim hisobida qaytarilishi lozim moddiy jihozlar mavjud emas (${docNumber})`,
          },
        });
      }
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

    try {
      await this.telegram.sendMessage(
        `✅ <b>Omborchi barcha aktivlar qabul qilinganini tasdiqladi:</b>\n\n` +
        `👤 <b>Xodim:</b> ${user.fullName} (@${user.username})\n` +
        `📦 <b>Qabul qilingan aktivlar soni:</b> ${activeAssignments.length} ta\n\n` +
        `💼 <i>Hurmatli kadr xodimi, ishdan bo'shatishni rasman yakunlashingiz mumkin.</i>`
      );
    } catch {}

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

    const performer = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { id: true, role: true, organizationId: true },
    });

    const isSuperAdmin = performer?.role === UserRole.SUPER_ADMIN;

    if (!isSuperAdmin && performer?.organizationId && user.organizationId && user.organizationId !== performer.organizationId) {
      throw new ForbiddenException("Siz faqat o'z tashkilotingiz xodimlarini boshqara olasiz!");
    }

    if (performer?.role === UserRole.KADR && user.role !== UserRole.XODIM) {
      throw new ForbiddenException("Kadrlar bo'limi faqat oddiy 'Xodim' hisobini ishdan bo'shata oladi!");
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

    const docNumber = `AKT-${now.getFullYear()}-${userId.slice(0, 6).toUpperCase()}`;
    await this.prisma.operation.updateMany({
      where: {
        userId,
        documentNumber: docNumber,
      },
      data: {
        note: `Xodim rasman ishdan bo'shatildi: jihozlar topshirildi (${docNumber})`,
      },
    });

    await this.auditService.log({
      userId: performedById,
      action: AuditAction.UPDATE,
      tableName: 'User',
      recordId: userId,
      oldData: { employmentStatus: user.employmentStatus, isActive: true },
      newData: { employmentStatus: EmploymentStatus.OFFBOARDED, isActive: false },
    });

    this.eventsGateway.broadcastOffboardingCompleted(updatedUser);

    try {
      await this.telegram.sendMessage(
        `🚪 <b>Xodim rasman ishdan bo'shatildi:</b>\n\n` +
        `👤 <b>Xodim:</b> ${user.fullName}\n` +
        `📅 <b>Sana:</b> ${now.toLocaleDateString('uz-UZ')}\n` +
        `🔒 <i>Tizimga kirish huquqlari to'liq bekor qilindi va hisob arxivlandi.</i>`
      );
    } catch {}

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
        organization: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        offboardingStartedBy: { select: { id: true, fullName: true, position: true } },
        warehouseApprovedBy: { select: { id: true, fullName: true, position: true } },
        offboardingCompletedBy: { select: { id: true, fullName: true, position: true } },
      },
    });

    if (!user) {
      throw new NotFoundException("Xodim topilmadi");
    }

    const docNumber = `AKT-${(user.offboardingCompletedAt || user.warehouseApprovedAt || user.offboardingStartedAt || new Date()).getFullYear()}-${userId.slice(0, 6).toUpperCase()}`;

    // Faqat shu offboarding jarayonida qaytarilgan jihozlar (avvalgi eski topshirilganlar kirmaydi)
    const returnedOperations = await this.prisma.operation.findMany({
      where: {
        userId,
        type: OperationType.RETURN_FROM_USER,
        quantity: { gt: 0 },
        OR: [
          { documentNumber: docNumber },
          ...(user.offboardingStartedAt ? [{ createdAt: { gte: user.offboardingStartedAt } }] : []),
        ],
      },
      include: {
        product: { select: { name: true, unit: true } },
        asset: { select: { inventoryNumber: true, serialNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      documentNumber: docNumber,
      documentDate: user.offboardingCompletedAt || user.warehouseApprovedAt || new Date(),
      organizationName: user.organization?.name || "Tashkilot",
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
