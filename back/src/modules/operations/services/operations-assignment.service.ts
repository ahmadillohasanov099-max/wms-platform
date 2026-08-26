import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { ProductType } from '@prisma/client';
import { GiveToUserDto } from '../dto/give-to-user.dto';
import { ReturnFromUserDto } from '../dto/return-from-user.dto';
import { TransferUserDto } from '../dto/transfer-user.dto';
import { GiveToDeptDto } from '../dto/give-to-dept.dto';
import { ReturnFromDeptDto } from '../dto/return-from-dept.dto';
import { AssignToDeptDto } from '../dto/assign-to-dept.dto';
import { EventsGateway } from '../../events/events.gateway';
import { OperationsNotifierService } from './operations-notifier.service';

@Injectable()
export class OperationsAssignmentService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private notifierService: OperationsNotifierService,
  ) {}

  async getPerformerOrg(performedById: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { id: true, role: true, organizationId: true },
    });
    const isSuperOrMinistry =
      user?.role === 'SUPER_ADMIN' ||
      user?.role === 'VAZIRLIK_OMBORCHI';
    return {
      performerOrgId: user?.organizationId || null,
      isSuperOrMinistry,
    };
  }

  async giveToUser(dto: GiveToUserDto, performedById: string) {
    const { performerOrgId, isSuperOrMinistry } = await this.getPerformerOrg(performedById);

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Xodim topilmadi');

    if (!isSuperOrMinistry && performerOrgId) {
      if (user.organizationId && user.organizationId !== performerOrgId) {
        throw new BadRequestException('Ushbu xodim sizning tashkilotingizga tegishli emas!');
      }
      if (product.organizationId && product.organizationId !== performerOrgId) {
        throw new BadRequestException('Ushbu mahsulot sizning tashkilotingizga tegishli emas!');
      }
    }

    if (product.productType !== ProductType.BERILADIGAN) {
      const qtyToGive = dto.quantity && dto.quantity > 0 ? dto.quantity : 1;
      const result = await this.prisma.$transaction(async (tx) => {
        const invUpdate = await tx.inventory.updateMany({
          where: { productId: dto.productId, quantity: { gte: qtyToGive } },
          data: { quantity: { decrement: qtyToGive } },
        });
        if (invUpdate.count === 0) {
          throw new BadRequestException("Omborda yetarli miqdorda TMZ yo'q");
        }

        const op = await tx.operation.create({
          data: {
            type: 'GIVE_TO_USER',
            quantity: qtyToGive,
            userId: dto.userId,
            productId: dto.productId,
            performedById,
            documentNumber: dto.documentNumber,
            note: dto.note,
            organizationId: performerOrgId,
          },
        });

        this.notifierService.notifyTelegramForOperation(op.id, dto.documentNumber);

        return { message: `${product.name} (${qtyToGive} ${product.unit || 'dona'}) xodimga berildi` };
      });

      void this.notifierService.checkStockAndAlert(dto.productId);
      this.eventsGateway.broadcastInventoryUpdated({ productId: dto.productId });
      return result;
    }

    if (!dto.inventoryNumber) {
      throw new BadRequestException("Asosiy vositalar uchun inventar raqami tanlanishi shart!");
    }

    const existingAsset = await this.prisma.asset.findFirst({
      where: {
        inventoryNumber: dto.inventoryNumber,
        deletedAt: null,
        ...(!isSuperOrMinistry && performerOrgId ? { organizationId: performerOrgId } : {}),
      },
      include: { assignments: { where: { returnedAt: null } } },
    });

    if (!existingAsset) {
      throw new BadRequestException('Ushbu inventar raqami topilmadi. Avval omborga kirim qiling!');
    }

    if (!isSuperOrMinistry && performerOrgId && existingAsset.organizationId && existingAsset.organizationId !== performerOrgId) {
      throw new BadRequestException('Ushbu jihoz sizning tashkilotingizga tegishli emas!');
    }

    if (existingAsset.productId !== dto.productId) {
      throw new BadRequestException(
        'Bu inventar raqami boshqa mahsulotga tegishli',
      );
    }
    if (existingAsset.status !== 'ACTIVE') {
      throw new BadRequestException('Bu jihoz faol holatda emas');
    }
    if (existingAsset.assignments.length > 0) {
      throw new BadRequestException(
        'Bu jihoz hozirda boshqa xodimga biriktirilgan',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const assetId = existingAsset.id;
      if (
        dto.serialNumber &&
        existingAsset.serialNumber !== dto.serialNumber
      ) {
        await tx.asset.update({
          where: { id: existingAsset.id },
          data: { serialNumber: dto.serialNumber },
        });
      }

      await tx.assignment.create({
        data: { userId: dto.userId, assetId, status: 'PENDING' },
      });

      const invUpdate = await tx.inventory.updateMany({
        where: { productId: dto.productId, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (invUpdate.count === 0) {
        throw new BadRequestException("Omborda yetarli miqdor yo'q");
      }

      const op = await tx.operation.create({
        data: {
          type: 'GIVE_TO_USER',
          quantity: 1,
          userId: dto.userId,
          assetId,
          productId: dto.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
          organizationId: performerOrgId,
        },
      });

      this.notifierService.notifyTelegramForOperation(op.id, dto.documentNumber);

      return tx.asset.findUnique({
        where: { id: assetId },
        include: {
          product: { select: { id: true, name: true } },
          assignments: {
            where: { returnedAt: null },
            include: { user: { select: { id: true, fullName: true } } },
          },
        },
      });
    });

    void this.notifierService.checkStockAndAlert(dto.productId);

    this.eventsGateway.broadcastInventoryUpdated({ productId: dto.productId });
    this.eventsGateway.broadcastAssignmentCreated({
      userId: dto.userId,
      assetName: product?.name || 'Jihoz',
      inventoryNumber: existingAsset.inventoryNumber,
      serialNumber: dto.serialNumber || existingAsset.serialNumber,
      documentNumber: dto.documentNumber,
      assignedAt: new Date().toISOString(),
    });

    return result;
  }

  async assignToDept(dto: AssignToDeptDto, performedById: string) {
    const { performerOrgId, isSuperOrMinistry } = await this.getPerformerOrg(performedById);

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');
    if (product.productType !== ProductType.BERILADIGAN) {
      throw new BadRequestException(
        "Faqat BERILADIGAN mahsulot bo'limga jihoz sifatida biriktiriladi",
      );
    }

    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, deletedAt: null },
    });
    if (!department) throw new NotFoundException("Bo'lim topilmadi");

    if (!isSuperOrMinistry && performerOrgId) {
      if (department.organizationId && department.organizationId !== performerOrgId) {
        throw new BadRequestException('Ushbu bo‘lim sizning tashkilotingizga tegishli emas!');
      }
      if (product.organizationId && product.organizationId !== performerOrgId) {
        throw new BadRequestException('Ushbu mahsulot sizning tashkilotingizga tegishli emas!');
      }
    }

    if (!dto.inventoryNumber) {
      throw new BadRequestException("Bo'limga biriktirish uchun inventar raqami tanlanishi shart!");
    }

    const existingAsset = await this.prisma.asset.findFirst({
      where: {
        inventoryNumber: dto.inventoryNumber,
        deletedAt: null,
        ...(!isSuperOrMinistry && performerOrgId ? { organizationId: performerOrgId } : {}),
      },
      include: { assignments: { where: { returnedAt: null } } },
    });

    if (!existingAsset) {
      throw new BadRequestException('Ushbu inventar raqami topilmadi. Avval omborga kirim qiling!');
    }

    if (!isSuperOrMinistry && performerOrgId && existingAsset.organizationId && existingAsset.organizationId !== performerOrgId) {
      throw new BadRequestException('Ushbu jihoz sizning tashkilotingizga tegishli emas!');
    }

    if (existingAsset.productId !== dto.productId) {
      throw new BadRequestException(
        'Bu inventar raqami boshqa mahsulotga tegishli',
      );
    }
    if (existingAsset.status !== 'ACTIVE') {
      throw new BadRequestException('Bu jihoz faol holatda emas');
    }
    if (existingAsset.assignments.length > 0) {
      throw new BadRequestException(
        'Bu jihoz hozirda kimga yoki qaysi bo‘limga biriktirilgan',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const assetId = existingAsset.id;
      if (
        dto.serialNumber &&
        existingAsset.serialNumber !== dto.serialNumber
      ) {
        await tx.asset.update({
          where: { id: existingAsset.id },
          data: { serialNumber: dto.serialNumber },
        });
      }

      await tx.assignment.create({
        data: { departmentId: dto.departmentId, assetId, status: 'PENDING' },
      });

      await tx.departmentAsset.upsert({
        where: {
          departmentId_productId: {
            departmentId: dto.departmentId,
            productId: dto.productId,
          },
        },
        update: { quantity: { increment: 1 } },
        create: {
          departmentId: dto.departmentId,
          productId: dto.productId,
          quantity: 1,
        },
      });

      const invUpdate = await tx.inventory.updateMany({
        where: { productId: dto.productId, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (invUpdate.count === 0) {
        throw new BadRequestException("Omborda yetarli miqdor yo'q");
      }

      const op = await tx.operation.create({
        data: {
          type: 'ASSIGN_TO_DEPT',
          quantity: 1,
          departmentId: dto.departmentId,
          assetId,
          productId: dto.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
          organizationId: performerOrgId,
        },
      });

      this.notifierService.notifyTelegramForOperation(op.id, dto.documentNumber);

      return tx.asset.findUnique({
        where: { id: assetId },
        include: {
          product: { select: { id: true, name: true } },
          assignments: {
            where: { returnedAt: null },
            include: { department: { select: { id: true, name: true } } },
          },
        },
      });
    });

    void this.notifierService.checkStockAndAlert(dto.productId);

    this.eventsGateway.broadcastInventoryUpdated({ productId: dto.productId });
    this.eventsGateway.broadcastAssignmentCreated({
      departmentId: dto.departmentId,
      leaderId: department.leaderId || undefined,
      departmentName: department.name,
      assetName: product?.name || 'Jihoz',
      inventoryNumber: existingAsset.inventoryNumber,
      serialNumber: dto.serialNumber || existingAsset.serialNumber,
      documentNumber: dto.documentNumber,
      assignedAt: new Date().toISOString(),
    });

    return result;
  }

  async returnFromUser(dto: ReturnFromUserDto, performedById: string) {
    const { performerOrgId, isSuperOrMinistry } = await this.getPerformerOrg(performedById);

    const asset = await this.prisma.asset.findFirst({
      where: { id: dto.assetId, deletedAt: null },
      include: { product: true },
    });
    if (!asset) throw new NotFoundException('Jihoz topilmadi');

    if (!isSuperOrMinistry && performerOrgId && asset.organizationId && asset.organizationId !== performerOrgId) {
      throw new BadRequestException('Ushbu jihoz sizning tashkilotingizga tegishli emas!');
    }

    const assignment = await this.prisma.assignment.findFirst({
      where: { userId: dto.userId, assetId: dto.assetId, returnedAt: null },
    });
    if (!assignment) {
      throw new BadRequestException('Bu jihoz ushbu xodimda emas');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { returnedAt: new Date() },
      });

      await tx.inventory.update({
        where: { productId: asset.productId },
        data: { quantity: { increment: 1 } },
      });

      const op = await tx.operation.create({
        data: {
          type: 'RETURN_FROM_USER',
          quantity: 1,
          userId: dto.userId,
          assetId: dto.assetId,
          productId: asset.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
          organizationId: performerOrgId,
        },
      });

      this.notifierService.notifyTelegramForOperation(op.id, dto.documentNumber);

      return { message: 'Jihoz muvaffaqiyatli qaytarildi', op };
    });

    this.eventsGateway.broadcastAssignmentUpdated({
      type: 'RETURN_FROM_USER',
      userId: dto.userId,
      assetId: dto.assetId,
    });
    this.eventsGateway.broadcastInventoryUpdated({
      productId: asset.productId,
    });
    this.eventsGateway.broadcastOperationCreated(result.op);

    return { message: result.message };
  }

  async transferUser(dto: TransferUserDto, performedById: string) {
    const { performerOrgId, isSuperOrMinistry } = await this.getPerformerOrg(performedById);

    const asset = await this.prisma.asset.findFirst({
      where: { id: dto.assetId, deletedAt: null },
      include: { product: true },
    });
    if (!asset) throw new NotFoundException('Jihoz topilmadi');

    if (!isSuperOrMinistry && performerOrgId && asset.organizationId && asset.organizationId !== performerOrgId) {
      throw new BadRequestException('Ushbu jihoz sizning tashkilotingizga tegishli emas!');
    }

    const assignment = await this.prisma.assignment.findFirst({
      where: { userId: dto.fromUserId, assetId: dto.assetId, returnedAt: null },
    });
    if (!assignment) {
      throw new BadRequestException("Bu jihoz ko'rsatilgan xodimda emas");
    }

    const toUser = await this.prisma.user.findFirst({
      where: { id: dto.toUserId, deletedAt: null },
    });
    if (!toUser) throw new NotFoundException('Xodim topilmadi');

    if (!isSuperOrMinistry && performerOrgId && toUser.organizationId && toUser.organizationId !== performerOrgId) {
      throw new BadRequestException('Qabul qiluvchi xodim sizning tashkilotingizga tegishli emas!');
    }

    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException("Bir xil xodimga o'tkazib bo'lmaydi");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { returnedAt: new Date() },
      });

      await tx.assignment.create({
        data: { userId: dto.toUserId, assetId: dto.assetId },
      });

      const op = await tx.operation.create({
        data: {
          type: 'TRANSFER_USER',
          quantity: 1,
          userId: dto.toUserId,
          fromUserId: dto.fromUserId,
          assetId: dto.assetId,
          productId: asset.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
          organizationId: performerOrgId,
        },
      });

      this.notifierService.notifyTelegramForOperation(op.id, dto.documentNumber);

      return { message: "Jihoz muvaffaqiyatli o'tkazildi", op };
    });

    this.eventsGateway.broadcastAssignmentUpdated({
      type: 'TRANSFER_USER',
      fromUserId: dto.fromUserId,
      toUserId: dto.toUserId,
      assetId: dto.assetId,
    });
    this.eventsGateway.broadcastAssignmentCreated({
      userId: dto.toUserId,
      assetId: dto.assetId,
    });
    this.eventsGateway.broadcastOperationCreated(result.op);

    return { message: result.message };
  }

  async giveToDept(dto: GiveToDeptDto, performedById: string) {
    const { performerOrgId, isSuperOrMinistry } = await this.getPerformerOrg(performedById);

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');
    if (product.productType !== ProductType.SARFLANADIGAN) {
      throw new BadRequestException(
        "Faqat SARFLANADIGAN mahsulot bo'limga beriladi",
      );
    }

    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, deletedAt: null },
    });
    if (!department) throw new NotFoundException("Bo'lim topilmadi");

    if (!isSuperOrMinistry && performerOrgId) {
      if (department.organizationId && department.organizationId !== performerOrgId) {
        throw new BadRequestException('Ushbu bo‘lim sizning tashkilotingizga tegishli emas!');
      }
      if (product.organizationId && product.organizationId !== performerOrgId) {
        throw new BadRequestException('Ushbu mahsulot sizning tashkilotingizga tegishli emas!');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const invUpdate = await tx.inventory.updateMany({
        where: { productId: dto.productId, quantity: { gte: dto.quantity } },
        data: { quantity: { decrement: dto.quantity } },
      });
      if (invUpdate.count === 0) {
        throw new BadRequestException("Omborda yetarli miqdor yo'q");
      }

      const op = await tx.operation.create({
        data: {
          type: 'GIVE_TO_DEPT',
          quantity: dto.quantity,
          departmentId: dto.departmentId,
          productId: dto.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
          organizationId: performerOrgId,
        },
      });

      this.notifierService.notifyTelegramForOperation(op.id, dto.documentNumber);

      return { message: "Material bo'limga muvaffaqiyatli berildi", op };
    });

    void this.notifierService.checkStockAndAlert(dto.productId);
    this.eventsGateway.broadcastInventoryUpdated({ productId: dto.productId });
    this.eventsGateway.broadcastAssignmentCreated({ departmentId: dto.departmentId });
    this.eventsGateway.broadcastOperationCreated(result.op);

    return { message: result.message };
  }

  async returnFromDept(dto: ReturnFromDeptDto, performedById: string) {
    const { performerOrgId, isSuperOrMinistry } = await this.getPerformerOrg(performedById);

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    if (product.productType === ProductType.BERILADIGAN) {
      if (!dto.assetId) {
        throw new BadRequestException(
          'Jihozni qaytarish uchun assetId ko‘rsatilishi shart!',
        );
      }

      const asset = await this.prisma.asset.findFirst({
        where: { id: dto.assetId, deletedAt: null },
      });
      if (!asset) throw new NotFoundException('Jihoz topilmadi');

      if (!isSuperOrMinistry && performerOrgId && asset.organizationId && asset.organizationId !== performerOrgId) {
        throw new BadRequestException('Ushbu jihoz sizning tashkilotingizga tegishli emas!');
      }

      const assignment = await this.prisma.assignment.findFirst({
        where: {
          assetId: dto.assetId,
          returnedAt: null,
          OR: [
            { departmentId: dto.departmentId },
            { user: { departmentId: dto.departmentId, deletedAt: null } },
          ],
        },
      });
      if (!assignment) {
        throw new BadRequestException(
          'Bu jihoz ushbu bo‘limga yoki bo\'lim xodimiga biriktirilmagan',
        );
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.assignment.update({
          where: { id: assignment.id },
          data: { returnedAt: new Date() },
        });

        await tx.departmentAsset.updateMany({
          where: {
            departmentId: dto.departmentId,
            productId: dto.productId,
            quantity: { gte: 1 },
          },
          data: { quantity: { decrement: 1 } },
        });

        await tx.inventory.update({
          where: { productId: dto.productId },
          data: { quantity: { increment: 1 } },
        });

        const op = await tx.operation.create({
          data: {
            type: assignment.userId ? 'RETURN_FROM_USER' : 'RETURN_FROM_DEPT',
            quantity: 1,
            departmentId: dto.departmentId,
            userId: assignment.userId || undefined,
            assetId: dto.assetId,
            productId: dto.productId,
            performedById,
            documentNumber: dto.documentNumber,
            note: dto.note,
            organizationId: performerOrgId,
          },
        });

        return { message: "Jihoz omborga muvaffaqiyatli qaytarildi", op };
      });

      this.eventsGateway.broadcastAssignmentUpdated({
        type: 'RETURN_FROM_DEPT',
        departmentId: dto.departmentId,
        assetId: dto.assetId,
      });
      this.eventsGateway.broadcastInventoryUpdated({
        productId: dto.productId,
      });
      this.eventsGateway.broadcastOperationCreated(result.op);

      return { message: result.message };
    }

    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException(
        'Sarflanadigan materialni qaytarish uchun quantity 0 dan katta bo‘lishi shart!',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const deptUpdate = await tx.departmentAsset.updateMany({
        where: {
          departmentId: dto.departmentId,
          productId: dto.productId,
          quantity: { gte: dto.quantity! },
        },
        data: { quantity: { decrement: dto.quantity! } },
      });
      if (deptUpdate.count === 0) {
        throw new BadRequestException("Bo'limda yetarli miqdor yo'q");
      }

      await tx.inventory.update({
        where: { productId: dto.productId },
        data: { quantity: { increment: dto.quantity! } },
      });

      const op = await tx.operation.create({
        data: {
          type: 'RETURN_FROM_DEPT',
          quantity: dto.quantity!,
          departmentId: dto.departmentId,
          productId: dto.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
          organizationId: performerOrgId,
        },
      });

      return { message: "Material bo'limdan muvaffaqiyatli qaytarildi", op };
    });

    this.eventsGateway.broadcastAssignmentUpdated({
      type: 'RETURN_FROM_DEPT',
      departmentId: dto.departmentId,
    });
    this.eventsGateway.broadcastInventoryUpdated({
      productId: dto.productId,
    });
    this.eventsGateway.broadcastOperationCreated(result.op);

    return { message: result.message };
  }

  async acceptAssignment(assignmentId: string, currentUserId: string, currentUserRole: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        user: true,
        department: {
          include: {
            leader: { select: { id: true, fullName: true } },
          },
        },
        asset: { include: { product: true } },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Biriktirish topilmadi');
    }
    if (assignment.status === 'ACCEPTED') {
      return { message: 'Jihoz allaqachon qabul qilingan' };
    }

    const isSuperOrAdmin =
      currentUserRole === 'SUPER_ADMIN' ||
      currentUserRole === 'ORG_ADMIN' ||
      currentUserRole === 'ADMIN';

    if (assignment.userId) {
      if (assignment.userId !== currentUserId && !isSuperOrAdmin) {
        throw new BadRequestException('Faqat jihoz biriktirilgan xodim yoki admin uni qabul qilishi mumkin');
      }
    } else if (assignment.departmentId) {
      const isDeptLeader = assignment.department?.leaderId === currentUserId;
      if (!isDeptLeader && !isSuperOrAdmin) {
        throw new BadRequestException('Bo‘limga biriktirilgan jihozni faqat bo‘lim boshlig‘i yoki admin qabul qilishi mumkin');
      }
    }

    await this.prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    this.eventsGateway.broadcastAssignmentUpdated({
      type: 'ASSIGNMENT_ACCEPTED',
      assignmentId,
    });

    return {
      message: `"${assignment.asset.product.name}" jihozi muvaffaqiyatli qabul qilindi`,
    };
  }

  async rejectAssignment(
    assignmentId: string,
    reason: string,
    currentUserId: string,
    currentUserRole: string,
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        user: true,
        department: {
          include: {
            leader: { select: { id: true, fullName: true } },
          },
        },
        asset: { include: { product: true } },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Biriktirish topilmadi');
    }
    if (assignment.status === 'REJECTED') {
      return { message: 'Jihoz allaqachon rad etilgan' };
    }

    const isSuperOrAdmin =
      currentUserRole === 'SUPER_ADMIN' ||
      currentUserRole === 'ORG_ADMIN' ||
      currentUserRole === 'ADMIN';

    if (assignment.userId) {
      if (assignment.userId !== currentUserId && !isSuperOrAdmin) {
        throw new BadRequestException('Faqat jihoz biriktirilgan xodim yoki admin uni rad etishi mumkin');
      }
    } else if (assignment.departmentId) {
      const isDeptLeader = assignment.department?.leaderId === currentUserId;
      if (!isDeptLeader && !isSuperOrAdmin) {
        throw new BadRequestException('Bo‘limga biriktirilgan jihozni faqat bo‘lim boshlig‘i yoki admin rad etishi mumkin');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: reason || 'Xodim tomonidan rad etildi',
          returnedAt: new Date(),
        },
      });

      // Return asset to inventory
      await tx.inventory.update({
        where: { productId: assignment.asset.productId },
        data: { quantity: { increment: 1 } },
      });

      // If it was assigned to department, decrement DepartmentAsset
      if (assignment.departmentId) {
        await tx.departmentAsset.updateMany({
          where: {
            departmentId: assignment.departmentId,
            productId: assignment.asset.productId,
            quantity: { gte: 1 },
          },
          data: { quantity: { decrement: 1 } },
        });
      }

      // Create a notification for Admin and Omborchi
      const targetOrgId = assignment.asset.organizationId || assignment.user?.organizationId || '';
      if (targetOrgId) {
        const notif = await tx.deletionRequest.create({
          data: {
            organizationId: targetOrgId,
            requestedById: currentUserId,
            entityType: 'ASSET',
            entityId: assignment.assetId,
            entityName: `${assignment.asset.product?.name || 'Jihoz'} (Inv: ${assignment.asset.inventoryNumber})`,
            reason: `❌ Jihozni qabul qilish rad etildi: "${reason || 'Sabab ko‘rsatilmadi'}"`,
            status: 'PENDING',
          },
          include: {
            organization: { select: { id: true, name: true, code: true } },
            requestedBy: { select: { id: true, fullName: true, username: true } },
          },
        });

        this.eventsGateway.broadcastRequestCreated(notif);
      }

      this.eventsGateway.broadcastAssignmentUpdated({
        type: 'ASSIGNMENT_REJECTED',
        assignmentId,
      });

      return {
        message: `"${assignment.asset.product.name}" jihozi rad etildi va ombor hisobiga qaytarildi`,
      };
    });
  }
}
