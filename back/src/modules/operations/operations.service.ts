import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { ProductType } from '@prisma/client';
import { StockInDto } from './dto/stock-in.dto';
import { GiveToUserDto } from './dto/give-to-user.dto';
import { ReturnFromUserDto } from './dto/return-from-user.dto';
import { TransferUserDto } from './dto/transfer-user.dto';
import { GiveToDeptDto } from './dto/give-to-dept.dto';
import { ReturnFromDeptDto } from './dto/return-from-dept.dto';
import { WriteOffDto } from './dto/write-off.dto';
import { BulkWriteOffDto } from './dto/bulk-write-off.dto';
import { AssignToDeptDto } from './dto/assign-to-dept.dto';
import { MailService, TelegramService } from '../nodemailer';
import { t, numberToWordsUz } from 'src/common';
import { I18nContext } from 'nestjs-i18n';

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


@Injectable()
export class OperationsService {
  private pendingBatchDocTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private telegramService: TelegramService,
  ) {}


  private async checkStockAndAlert(productId: string) {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { productId },
        include: { product: true },
      });

      if (
        inventory &&
        inventory.product &&
        inventory.quantity < inventory.minLevel
      ) {
        this.mailService
          .sendLowStockAlert(
            inventory.product.name,
            inventory.quantity,
            inventory.minLevel,
          )
          .catch((err) =>
            console.error('Failed to send stock alert email:', err),
          );

        this.telegramService
          .sendLowStockAlert(
            inventory.product.name,
            inventory.quantity,
            inventory.minLevel,
          )
          .catch((err) =>
            console.error('Failed to send Telegram stock alert:', err),
          );
      }
    } catch (error) {
      console.error('Error checking stock level for email/telegram alert:', error);
    }
  }

  private async getPerformerOrg(performedById: string) {

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

  async stockIn(dto: StockInDto, performedById: string) {
    const { performerOrgId } = await this.getPerformerOrg(performedById);


    if (dto.productType === ProductType.BERILADIGAN) {
      if (
        !dto.inventoryNumbers ||
        dto.inventoryNumbers.length !== dto.quantity
      ) {
        throw new BadRequestException(
          `Inventar raqamlari soni (${dto.inventoryNumbers?.length || 0}) kirim qilinayotgan miqdorga (${dto.quantity}) teng bo'lishi kerak`,
        );
      }

      const uniqueNumbers = new Set(dto.inventoryNumbers);
      if (uniqueNumbers.size !== dto.inventoryNumbers.length) {
        throw new BadRequestException(
          'Kiritilgan inventar raqamlari ichida takrorlanishlar mavjud!',
        );
      }

      const existingAsset = await this.prisma.asset.findFirst({
        where: {
          inventoryNumber: { in: dto.inventoryNumbers },
          organizationId: performerOrgId,
          deletedAt: null,
        },
      });

      if (existingAsset) {
        throw new BadRequestException(
          `Inventar raqamlaridan biri bazada allaqachon band: ${existingAsset.inventoryNumber}`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let product = await tx.product.findFirst({
        where: {
          name: dto.name,
          productType: dto.productType,
          organizationId: performerOrgId,
          deletedAt: null,
        },
        include: { inventory: true },
      });

      if (!product) {
        product = await tx.product.create({
          data: {
            name: dto.name,
            productType: dto.productType,
            unit: dto.unit,
            year: dto.year,
            description: dto.description,
            imageUrl: dto.imageUrl,
            organizationId: performerOrgId,
          },
          include: { inventory: true },
        });

        await tx.inventory.create({
          data: {
            productId: product.id,
            quantity: 0,
            minLevel: dto.minLevel ?? 0,
            unitPrice: dto.unitPrice,
          },
        });
      }

      await tx.inventory.update({
        where: { productId: product.id },
        data: {
          quantity: { increment: dto.quantity },
          unitPrice: dto.unitPrice ?? undefined,
          totalValue: dto.unitPrice
            ? { increment: dto.unitPrice * dto.quantity }
            : undefined,
        },
      });

      if (dto.productType === ProductType.BERILADIGAN && dto.inventoryNumbers) {
        for (let i = 0; i < dto.inventoryNumbers.length; i++) {
          await tx.asset.create({
            data: {
              productId: product.id,
              inventoryNumber: dto.inventoryNumbers[i],
              serialNumber: dto.serialNumbers?.[i] || null,
              organizationId: performerOrgId,
              status: 'ACTIVE',
              purchasePrice: dto.unitPrice ?? null,
            },
          });
        }
      }

      await tx.operation.create({
        data: {
          type: 'STOCK_IN',
          quantity: dto.quantity,
          productId: product.id,
          performedById,
          documentNumber: dto.documentNumber,
          documentDate: dto.documentDate
            ? new Date(dto.documentDate)
            : undefined,
          note: dto.note,
          organizationId: performerOrgId,
        },
      });

      void this.prisma.user.findUnique({ where: { id: performedById }, select: { fullName: true } })
        .then((performer) => {
          void this.telegramService.sendOperationAlert(
            '📥 KIRIM QILINDI (Stock In)',
            dto.name,
            dto.quantity,
            'Markaziy Omborxona',
            performer?.fullName || 'Bosh Omborchi',
          );
        });

      return tx.product.findUnique({
        where: { id: product.id },
        include: { inventory: true },
      });
    });
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

        this.notifyTelegramForOperation(op.id, dto.documentNumber);

        return { message: `${product.name} (${qtyToGive} ${product.unit || 'dona'}) xodimga berildi` };
      });

      void this.checkStockAndAlert(dto.productId);
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
        data: { userId: dto.userId, assetId },
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

      this.notifyTelegramForOperation(op.id, dto.documentNumber);

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

    void this.checkStockAndAlert(dto.productId);
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
        data: { departmentId: dto.departmentId, assetId },
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


      this.notifyTelegramForOperation(op.id, dto.documentNumber);

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

    void this.checkStockAndAlert(dto.productId);
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

    return this.prisma.$transaction(async (tx) => {
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

      this.notifyTelegramForOperation(op.id, dto.documentNumber);

      return { message: 'Jihoz muvaffaqiyatli qaytarildi' };
    });
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

    return this.prisma.$transaction(async (tx) => {
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

      this.notifyTelegramForOperation(op.id, dto.documentNumber);

      return { message: "Jihoz muvaffaqiyatli o'tkazildi" };
    });
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

      this.notifyTelegramForOperation(op.id, dto.documentNumber);

      return { message: "Material bo'limga muvaffaqiyatli berildi" };
    });

    void this.checkStockAndAlert(dto.productId);
    return result;
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

      return this.prisma.$transaction(async (tx) => {
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

        await tx.operation.create({
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

        return { message: "Jihoz omborga muvaffaqiyatli qaytarildi" };
      });
    }

    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException(
        'Sarflanadigan materialni qaytarish uchun quantity 0 dan katta bo‘lishi shart!',
      );
    }

    return this.prisma.$transaction(async (tx) => {
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

      await tx.operation.create({
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

      return { message: "Material bo'limdan muvaffaqiyatli qaytarildi" };
    });
  }

  async writeOff(dto: WriteOffDto, performedById: string) {
    const { performerOrgId, isSuperOrMinistry } = await this.getPerformerOrg(performedById);

    if (dto.assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: dto.assetId, deletedAt: null },
        include: {
          product: true,
          assignments: { where: { returnedAt: null } },
        },
      });
      if (!asset) throw new NotFoundException('Jihoz topilmadi');

      if (!isSuperOrMinistry && performerOrgId && asset.organizationId && asset.organizationId !== performerOrgId) {
        throw new BadRequestException('Ushbu jihoz sizning tashkilotingizga tegishli emas!');
      }

      if (asset.assignments.length > 0) {
        throw new BadRequestException(
          'Jihoz xodimda bor, avval qaytarib oling',
        );
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id: dto.assetId },
          data: { status: 'WRITTEN_OFF', deletedAt: new Date() },
        });

        const invUpdate = await tx.inventory.updateMany({
          where: { productId: asset.productId, quantity: { gte: 1 } },
          data: { quantity: { decrement: 1 } },
        });
        if (invUpdate.count === 0) {
          throw new BadRequestException("Omborda yetarli miqdor yo'q");
        }

        const op = await tx.operation.create({
          data: {
            type: 'WRITE_OFF',
            quantity: 1,
            assetId: dto.assetId,
            productId: asset.productId,
            performedById,
            documentNumber: dto.documentNumber,
            note: dto.note,
            organizationId: performerOrgId,
          },
        });

        this.notifyTelegramForOperation(op.id, dto.documentNumber);

        return { message: 'Jihoz hisobdan chiqarildi' };
      });

      void this.checkStockAndAlert(asset.productId);
      return result;
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    if (!isSuperOrMinistry && performerOrgId && product.organizationId && product.organizationId !== performerOrgId) {
      throw new BadRequestException('Ushbu mahsulot sizning tashkilotingizga tegishli emas!');
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, deletedAt: null },
      });
      if (!department) throw new NotFoundException("Bo'lim topilmadi");

      if (!isSuperOrMinistry && performerOrgId && department.organizationId && department.organizationId !== performerOrgId) {
        throw new BadRequestException('Ushbu bo‘lim sizning tashkilotingizga tegishli emas!');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const deptAssetUpdate = await tx.departmentAsset.updateMany({
          where: {
            departmentId: dto.departmentId,
            productId: dto.productId,
            quantity: { gte: dto.quantity! },
          },
          data: { quantity: { decrement: dto.quantity! } },
        });

        if (deptAssetUpdate.count === 0) {
          throw new BadRequestException(
            "Bo'limda ushbu materialdan yetarli miqdor mavjud emas",
          );
        }

        await tx.operation.create({
          data: {
            type: 'WRITE_OFF',
            quantity: dto.quantity!,
            productId: dto.productId!,
            departmentId: dto.departmentId,
            performedById,
            documentNumber: dto.documentNumber,
            note: dto.note,
            organizationId: performerOrgId,
          },
        });

        return { message: "Material bo'limdan muvaffaqiyatli hisobdan chiqarildi" };
      });

      return result;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const invUpdate = await tx.inventory.updateMany({
        where: { productId: dto.productId, quantity: { gte: dto.quantity! } },
        data: { quantity: { decrement: dto.quantity! } },
      });
      if (invUpdate.count === 0) {
        throw new BadRequestException("Omborda yetarli miqdor yo'q");
      }

      await tx.operation.create({
        data: {
          type: 'WRITE_OFF',
          quantity: dto.quantity!,
          productId: dto.productId!,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
          departmentId: dto.departmentId,
          organizationId: performerOrgId,
        },
      });

      return { message: 'Mahsulot hisobdan chiqarildi' };
    });

    void this.checkStockAndAlert(dto.productId!);
    return result;
  }

  async bulkWriteOff(dto: BulkWriteOffDto, performedById: string) {
    const { performerOrgId, isSuperOrMinistry } = await this.getPerformerOrg(performedById);

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Hisobdan chiqarish uchun mahsulotlar tanlanishi kerak');
    }

    const docNum = dto.documentNumber || `DAL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, deletedAt: null },
          include: { inventory: true },
        });

        if (!product) {
          throw new NotFoundException(`Mahsulot topilmadi: ${item.productId}`);
        }

        if (!isSuperOrMinistry && performerOrgId && product.organizationId && product.organizationId !== performerOrgId) {
          throw new BadRequestException(`"${product.name}" mahsuloti sizning tashkilotingizga tegishli emas!`);
        }

        if (product.productType === ProductType.BERILADIGAN) {
          if (item.assetId) {
            const asset = await tx.asset.findFirst({
              where: { id: item.assetId, deletedAt: null },
              include: { assignments: { where: { returnedAt: null } } },
            });
            if (!asset) {
              throw new NotFoundException(`Jihoz topilmadi: ${item.assetId}`);
            }

            if (!isSuperOrMinistry && performerOrgId && asset.organizationId && asset.organizationId !== performerOrgId) {
              throw new BadRequestException(`"${product.name}" jihozi sizning tashkilotingizga tegishli emas!`);
            }

            if (asset.assignments.length > 0) {
              throw new BadRequestException(`"${product.name}" jihozi xodimga biriktirilgan, avval qaytarib oling`);
            }

            await tx.asset.update({
              where: { id: item.assetId },
              data: { status: 'WRITTEN_OFF', deletedAt: new Date() },
            });

            const invUpdate = await tx.inventory.updateMany({
              where: { productId: product.id, quantity: { gte: 1 } },
              data: { quantity: { decrement: 1 } },
            });
            if (invUpdate.count === 0) {
              throw new BadRequestException(`"${product.name}" mahsulotidan omborda yetarli miqdor yo'q`);
            }

            await tx.operation.create({
              data: {
                type: 'WRITE_OFF',
                quantity: 1,
                assetId: item.assetId,
                productId: product.id,
                performedById,
                documentNumber: docNum,
                note: dto.note,
                organizationId: performerOrgId,
              },
            });
          } else {
            const assets = await tx.asset.findMany({
              where: {
                productId: product.id,
                deletedAt: null,
                status: 'ACTIVE',
                ...(performerOrgId && !isSuperOrMinistry ? { organizationId: performerOrgId } : {}),
                assignments: { none: { returnedAt: null } },
              },
              take: item.quantity,
            });

            if (assets.length < item.quantity) {
              throw new BadRequestException(
                `"${product.name}" jihozida omborda yetarli miqdor yo'q (Mavjud: ${assets.length}, So'ralgan: ${item.quantity})`
              );
            }

            for (const asset of assets) {
              await tx.asset.update({
                where: { id: asset.id },
                data: { status: 'WRITTEN_OFF', deletedAt: new Date() },
              });

              await tx.operation.create({
                data: {
                  type: 'WRITE_OFF',
                  quantity: 1,
                  assetId: asset.id,
                  productId: product.id,
                  performedById,
                  documentNumber: docNum,
                  note: dto.note,
                  organizationId: performerOrgId,
                },
              });
            }

            const invUpdate = await tx.inventory.updateMany({
              where: { productId: product.id, quantity: { gte: item.quantity } },
              data: { quantity: { decrement: item.quantity } },
            });
            if (invUpdate.count === 0) {
              throw new BadRequestException(`"${product.name}" mahsulotidan omborda yetarli miqdor yo'q`);
            }
          }
        } else {
          const invUpdate = await tx.inventory.updateMany({
            where: { productId: product.id, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } },
          });
          if (invUpdate.count === 0) {
            throw new BadRequestException(`"${product.name}" materialidan omborda yetarli miqdor yo'q`);
          }

          await tx.operation.create({
            data: {
              type: 'WRITE_OFF',
              quantity: item.quantity,
              productId: product.id,
              performedById,
              documentNumber: docNum,
              note: dto.note,
            },
          });
        }
      }

      return { message: 'Belgilangan mahsulotlar muvaffaqiyatli hisobdan chiqarildi', documentNumber: docNum };
    });

    for (const item of dto.items) {
      void this.checkStockAndAlert(item.productId);
    }

    return result;
  }

  private notifyTelegramForOperation(opId: string, documentNumber?: string | null) {
    void this.sendImmediateOperationAlert(opId);

    const batchKey = documentNumber ? `DOC_${documentNumber}` : `OP_${opId}`;
    if (this.pendingBatchDocTimers.has(batchKey)) {
      clearTimeout(this.pendingBatchDocTimers.get(batchKey)!);
    }

    const timer = setTimeout(async () => {
      this.pendingBatchDocTimers.delete(batchKey);
      await this.processTelegramDocumentNotification(opId, documentNumber);
    }, 800);

    this.pendingBatchDocTimers.set(batchKey, timer);
  }

  private async sendImmediateOperationAlert(opId: string) {
    try {
      const op = await this.prisma.operation.findUnique({
        where: { id: opId },
        include: {
          product: true,
          user: true,
          department: true,
          performedBy: true,
        },
      });
      if (!op) return;

      let alertTitle = '📦 OMBOR OPERATSIYASI';
      const targetName = op.user?.fullName || op.department?.name || 'Markaziy Ombor';

      if (op.type === 'GIVE_TO_USER') alertTitle = '📤 XODIMGA BERILDI';
      else if (op.type === 'ASSIGN_TO_DEPT') alertTitle = '🏢 BO‘LIMGA BIRIKTIRILDI';
      else if (op.type === 'GIVE_TO_DEPT') alertTitle = '📤 BO‘LIMGA BERILDI';
      else if (op.type === 'RETURN_FROM_USER') alertTitle = '↩️ XODIMDAN QAYTARILDI';
      else if (op.type === 'TRANSFER_USER') alertTitle = '🔄 XODIMDAN XODIMGA O‘TKAZILDI';
      else if (op.type === 'WRITE_OFF') alertTitle = '🗑️ HISOBDAN CHIQARILDI';

      void this.telegramService.sendOperationAlert(
        alertTitle,
        op.product?.name || 'Mahsulot',
        op.quantity,
        targetName,
        op.performedBy?.fullName || 'Bosh Omborchi',
      );
    } catch (err) {
      console.error('Error sending immediate Telegram operation alert:', err);
    }
  }

  private async processTelegramDocumentNotification(opId: string, documentNumber?: string | null) {
    try {
      const mainOp = await this.prisma.operation.findUnique({
        where: { id: opId },
        include: {
          product: true,
          asset: true,
          user: { include: { department: true } },
          department: true,
          performedBy: true,
        },
      });
      if (!mainOp) return;

      const relatedOps = documentNumber
        ? await this.prisma.operation.findMany({
            where: {
              documentNumber: documentNumber,
              type: mainOp.type,
            },
            include: {
              product: true,
              asset: true,
              user: { include: { department: true } },
              department: true,
              performedBy: true,
            },
            orderBy: { createdAt: 'asc' },
          })
        : [mainOp];

      if (relatedOps.length === 0) return;

      const isAsosiyVosita = mainOp.product?.productType === ProductType.BERILADIGAN;

      if (isAsosiyVosita && (mainOp.type === 'GIVE_TO_USER' || mainOp.type === 'ASSIGN_TO_DEPT')) {
        const docNumStr = documentNumber || mainOp.documentNumber || `MJSH-${opId.slice(-6)}`;
        const targetUser = mainOp.user;
        const targetName = targetUser
          ? targetUser.fullName
          : mainOp.department
          ? mainOp.department.name
          : 'Xodim';

        const items = relatedOps.map((op) => ({
          name: op.product?.name || 'Mahsulot',
          inventoryNumber: op.asset?.inventoryNumber || '',
          serialNumber: op.asset?.serialNumber || '',
        }));

        const pdfBuffer = await this.generateModdiyJavobgarlikPdf({
          documentNumber: docNumStr,
          date: mainOp.createdAt,
          toRecipient: targetName,
          recipientPassport: targetUser?.passport || '',
          recipientAddress: targetUser?.address || '',
          items,
        });

        const filename = `moddiy_javobgarlik_shartnomasi_${docNumStr}.pdf`;
        const caption =
          `📄 <b>MODDIY JAVOBGARLIK SHARTNOMASI</b>\n\n` +
          `📌 <b>Hujjat №:</b> ${docNumStr}\n` +
          `👤 <b>Qabul qildi:</b> ${targetName}\n` +
          `✍️ <b>Topshirdi:</b> ${mainOp.performedBy?.fullName || 'Bosh Omborchi'}\n` +
          `📦 <b>Jihozlar soni:</b> ${items.length} ta`;

        await this.telegramService.sendDocumentBuffer(filename, pdfBuffer, caption);
      } else if (!isAsosiyVosita && (mainOp.type === 'GIVE_TO_USER' || mainOp.type === 'GIVE_TO_DEPT')) {
        const docNumStr = documentNumber || mainOp.documentNumber || `${opId.slice(-6)}`;
        const targetUser = mainOp.user;
        const targetName = targetUser
          ? `${targetUser.fullName}${targetUser.department?.name ? ` (${targetUser.department.name})` : ''}`
          : mainOp.department
          ? mainOp.department.name
          : 'Xodim';

        const items = relatedOps.map((op) => ({
          name: op.product?.name || 'Material',
          unit: op.product?.unit || 'ta',
          quantity: op.quantity,
        }));

        const pdfBuffer = await this.generateTalabnomaPdf({
          seqNumber: docNumStr,
          date: mainOp.createdAt,
          fromUser: mainOp.performedBy?.fullName || "Xo‘jalik mudiri",
          toRecipient: targetName,
          items,
        });

        const filename = `talabnoma_${docNumStr}.pdf`;
        const caption =
          `📋 <b>TALABNOMA</b>\n\n` +
          `📌 <b>Hujjat №:</b> ${docNumStr}\n` +
          `👤 <b>Kimga:</b> ${targetName}\n` +
          `✍️ <b>Kimdan:</b> ${mainOp.performedBy?.fullName || 'Xo‘jalik mudiri'}\n` +
          `📦 <b>Mahsulotlar soni:</b> ${items.length} xil`;

        await this.telegramService.sendDocumentBuffer(filename, pdfBuffer, caption);
      } else {
        const pdfBuffer = await this.generatePdfAct(opId);
        const filename = `dalolatnoma_${opId.slice(-6)}.pdf`;
        const caption = `📄 <b>OPERATSIYA DALOLATNOMASI</b>\n\n📌 <b>Hujjat ID:</b> ${opId}\n✍️ <b>Mas'ul:</b> ${mainOp.performedBy?.fullName || 'Bosh Omborchi'}`;
        await this.telegramService.sendDocumentBuffer(filename, pdfBuffer, caption);
      }
    } catch (err: any) {
      console.error('Telegram document generation error:', err);
    }
  }

  private async renderHtmlToPdf(htmlContent: string): Promise<Buffer> {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '10mm',
          right: '15mm',
          bottom: '10mm',
          left: '20mm',
        },
      });
      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  async generateModdiyJavobgarlikPdf(data: {
    documentNumber?: string;
    date?: Date;
    toRecipient?: string;
    recipientPassport?: string;
    recipientAddress?: string;
    orgName?: string;
    items: Array<{ name: string; inventoryNumber?: string; serialNumber?: string }>;
  }): Promise<Buffer> {
    const docDate = data.date ? new Date(data.date) : new Date();
    const day = docDate.getDate().toString().padStart(2, '0');
    const monthNames = [
      'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
      'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
    ];
    const monthName = monthNames[docDate.getMonth()];
    const year = docDate.getFullYear();

    const toNameStr = escapeHtml(data.toRecipient || '');
    const docNumStr = escapeHtml(data.documentNumber || `MJSH-${year}-${String(Date.now()).slice(-4)}`);
    const passportInfoStr = escapeHtml([data.recipientPassport, data.recipientAddress].filter(Boolean).join(', '));
    const orgName = escapeHtml(data.orgName || 'Ўзбекистон Республикаси Қурилиш ва уй-жой коммунал хўжалиги вазирлиги');

    const itemsHtml = data.items
      .map(
        (item) => `
      <div style="margin-bottom: 4px; text-align: justify;">
        - <strong style="font-weight: bold; color: #000;">${escapeHtml(item.name)}</strong> ${
          item.inventoryNumber
            ? `инвентар рақами <strong style="font-family: monospace; font-weight: bold; color: #000;">${escapeHtml(item.inventoryNumber)}</strong>`
            : ''
        }${
          item.serialNumber
            ? `, серия рақами <strong style="font-family: monospace; font-weight: bold;">${escapeHtml(item.serialNumber)}</strong>`
            : ''
        }
      </div>
    `,
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Moddiy Javobgarlik Shartnomasi</title>
          <style>
            @page {
              size: A4 portrait;
              margin-top: 15mm;
              margin-bottom: 15mm;
              margin-left: 20mm;
              margin-right: 15mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 0;
              width: 175mm;
            }
            .agreement-block {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              box-sizing: border-box;
              width: 100%;
              min-height: 260mm;
              padding: 0;
              line-height: 1.45;
              font-size: 11pt;
            }
          </style>
        </head>
        <body>
          <div class="agreement-block">
            <div>
              <div style="text-align: center; font-size: 13pt; font-weight: bold; margin-bottom: 3px; color: #000;">
                Якка тартибдаги тўлиқ моддий жавобгарлик тўғрисида
              </div>
              <div style="text-align: center; font-size: 12pt; font-weight: normal; margin-bottom: 14px; color: #000;">
                <u>&nbsp; ${docNumStr} &nbsp;</u>- сонли шартнома
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11pt; margin-bottom: 14px; font-weight: normal;">
                <div>${year} йил « <u>&nbsp; ${day} &nbsp;</u> » <u>&nbsp;&nbsp;&nbsp; ${monthName} &nbsp;&nbsp;&nbsp;</u></div>
                <div>Тошкент шаҳри</div>
              </div>

              <div style="text-align: justify; font-size: 11pt; margin-bottom: 12px; line-height: 1.45;">
                Ўзбекистон Республикаси Мехнат Кодексининг 203-моддасига асосан бир томондан Ўзбекистон Республикаси Қурилиш ва уй-жой коммунал ҳўжалиги вазирлиги вазири ўринбосари <strong style="font-weight: bold; color: #000;">Алиматов Таир Наматуллаевич</strong>, кейинги ўринларда “Иш берувчи” деб юритилади, иккинчи томондан <strong style="font-weight: bold; color: #000;">${toNameStr}</strong>${
      passportInfoStr ? ` (${passportInfoStr})` : ''
    }, кейинги ўринларда “Ходим” деб юритилади, мазкур шартномани қуйидагича туздилар:
              </div>

              <div style="text-align: justify; font-size: 11pt; margin-bottom: 8px; font-weight: normal;">
                1. “Ходим” “Иш берувчи” томонидан ишониб топширилган моддий кимматликларни яъни:
              </div>

              <div style="font-size: 10.5pt; margin-left: 10px; margin-bottom: 8px;">
                ${itemsHtml}
              </div>

              <div style="text-align: justify; font-size: 11pt; margin-bottom: 12px; font-weight: normal;">
                ушбу моддий бойликларни сақлаш, унга шикаст етказмаслик, маҳсус буйруқ ёки тегишли ҳужжатларсиз бошқа шахсларга топширмаслик бўйича жавобгарликни ўз зиммасига олади.
              </div>

              <div style="text-align: justify; font-size: 11pt; margin-bottom: 6px; font-weight: normal;">
                1.1. “Ходим” юқоридаги мол-мулкларни сақланишини таъминламаганлиги учун тўлиқ моддий жавобгарликни олишда қуйидагиларга мажбур:
              </div>
              <div style="font-size: 10.5pt; margin-left: 10px; margin-bottom: 10px; line-height: 1.4; text-align: justify; font-weight: normal;">
                а) “Иш берувчи”га унга ишониб топширган моддий қиммаликларни сақланишини таъминлашда хавф-хатар туғдирувчи хамма холатлар тўғрисида ўз вақтида хабар бериш;<br/>
                б) унга ишониб берилган қимматликларнинг харакати ва колдиклари тўғрисидамахсулот пул ва бошка хисоботлар хисобини олиб бориш ва белгиланган тартибда иш берувчи томонидан масъул қилиб белгиланган ходимга тақдим килиш:<br/>
                в) унга ишониб топширилган моддий қимматликларни рўйхатдан ўтказиш чоғида иштирок этиш:<br/>
                г) унга бириктирилган моддий қимматлик ва корхона мулкини сақламаганлик учун иш берувчига етказилган зарарни тўлиқ тўлаш:<br/>
                д) Ўзбёкистон Республикасининг амалдаги қонунларига асосан моддий жавобгарликни тўла равишда ўз зиммамга олиш.
              </div>

              <div style="text-align: justify; font-size: 11pt; margin-bottom: 10px; font-weight: normal;">
                1.2. Ходим иш берувчига етказилган зарарни, ўз ихтиёри билан амалдаги қонун ҳужжатлари асосида бирданига тўлаш ҳуқуқига эга.
              </div>

              <div style="text-align: justify; font-size: 11pt; margin-bottom: 6px; font-weight: normal;">
                Ходимнинг бошқа мажбуриятлари.
              </div>

              <div style="text-align: justify; font-size: 11pt; margin-bottom: 6px; font-weight: normal;">
                2. Иш берувчи қуйидагиларга мажбур:
              </div>
              <div style="font-size: 10.5pt; margin-left: 10px; margin-bottom: 10px; line-height: 1.4; text-align: justify; font-weight: normal;">
                а) ходимга нормал ишлашини ва унга ишониб топширилган моддий қимматликларни тўла сақлашни таъминлаш учун зарур шарт-шароитни яратиб бериш;<br/>
                б) ходимни иш берувчига келтирган зарари учун ходимларнинг тўлиқ моддий жавобгарлиги тўғрисидаги амалдаги қонунлар, шунингдек йурикномалар, мулкни сақлаш нормаси ва қоидалари билан таништириш:<br/>
                в) белгиланган тартибда моддий қимматликларни рўйхатдан ўтказишни олиб бориш.
              </div>

              <div style="text-align: justify; font-size: 11pt; margin-bottom: 8px; font-weight: normal;">
                2.1. Иш берувчи келтирилган зарар учун ходимдан ундиришни тўла ёки кисман рад этиш ҳуқуқига эга.
              </div>
              <div style="text-align: justify; font-size: 11pt; margin-bottom: 8px; font-weight: normal;">
                3. Ходим томонидан келтирилган зарар микдори ва уни тўлаш, хисобхона хисоби асосида ҳақиқий етказилган зарар буйича аникланади.
              </div>
              <div style="text-align: justify; font-size: 11pt; margin-bottom: 8px; font-weight: normal;">
                4. Агар зарар ходим айби билан келтирилмаганлиги ва шунингдек охирги зарурат ва шу каби жавобгарликни истисно қиладиган ҳолатлар натижасида келтирилганлиги аниқланса, у холда ходимдан моддий жавобгарлик олиб ташланади.
              </div>
              <div style="text-align: justify; font-size: 11pt; margin-bottom: 8px; font-weight: normal;">
                5. Мазкур шартнома иш берувчи томонидан ходимга моддий қимматлик ва мулк ишониб топширилган меҳнат муносабатлари давом этаётган вақтда кучга эга.
              </div>
              <div style="text-align: justify; font-size: 11pt; margin-bottom: 10px; font-weight: normal;">
                6. Шартнома икки нусхада тузилган булиб, иккаласи хам бирдек юридик кучга эга, улардан бири иш берувчида, иккинчиси эса ходимда сақланади.
              </div>

              <div style="text-align: justify; font-size: 11pt; margin-bottom: 12px; font-weight: normal;">
                Иш берувчининг бошқа мажбуриятлари.
              </div>
            </div>

            <div style="margin-top: 20px; font-size: 11pt; page-break-inside: avoid;">
              <div style="text-align: center; font-weight: bold; margin-bottom: 14px; color: #000;">
                7. Томонлар манзили ва имзолари:
              </div>

              <table style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 10.5pt;">
                <thead>
                  <tr>
                    <th style="width: 50%; text-align: center; font-weight: bold; padding-bottom: 8px; vertical-align: top; color: #000;">
                      “ИШ БЕРУВЧИ”
                    </th>
                    <th style="width: 50%; text-align: center; font-weight: bold; padding-bottom: 8px; vertical-align: top; color: #000;">
                      “ХОДИМ”
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="vertical-align: top; padding-right: 15px;">
                      <div style="text-align: center; font-weight: bold; line-height: 1.4; min-height: 45px;">
                        ${orgName}
                      </div>
                    </td>
                    <td style="vertical-align: top; padding-left: 15px;">
                      <div style="text-align: left; font-weight: normal; line-height: 1.4; min-height: 45px;">
                        <span style="font-weight: bold;">Манзили:</span> ${data.recipientAddress || '—'}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span style="font-weight: bold;">Паспорт:</span> ${data.recipientPassport || '—'}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="vertical-align: bottom; padding-top: 30px; padding-right: 15px;">
                      <div style="text-align: left; font-weight: bold; white-space: nowrap;">
                        ______________Т. Алиматов
                      </div>
                    </td>
                    <td style="vertical-align: bottom; padding-top: 30px; padding-left: 15px;">
                      <div style="text-align: left; font-weight: bold; white-space: nowrap;">
                        _____________ ${toNameStr}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.renderHtmlToPdf(htmlContent);
  }

  async generateTalabnomaPdf(data: {
    seqNumber?: string | number;
    date?: Date;
    fromUser?: string;
    toRecipient?: string;
    orgName?: string;
    items: Array<{ name: string; unit?: string; quantity: number }>;
  }): Promise<Buffer> {
    const docDate = data.date ? new Date(data.date) : new Date();
    const day = docDate.getDate().toString().padStart(2, '0');
    const monthNames = [
      'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
      'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
    ];
    const monthName = monthNames[docDate.getMonth()];
    const year = docDate.getFullYear();
    const fromName = data.fromUser || 'Xo‘jalik mudiri';
    const toName = data.toRecipient || '';
    const orgName = data.orgName || 'O‘zbekiston Respublikasi Qurilish va uy-joy kommunal xo‘jaligi vazirligi';

    const totalRows = 15;
    const rows: Array<{ index: number; name: string; unit: string; qty: string | number; qtyWords: string }> = [];
    for (let i = 0; i < totalRows; i++) {
      const item = data.items[i];
      rows.push({
        index: i + 1,
        name: item ? item.name : '',
        unit: item ? item.unit || 'ta' : '',
        qty: item ? item.quantity : '',
        qtyWords: item ? numberToWordsUz(item.quantity) : '',
      });
    }

    const tableRowsHtml = rows
      .map(
        (r) => `
      <tr style="height: 17px;">
        <td style="border: 1px solid #000; text-align: center; padding: 2px 2px; font-size: 8.5pt;">${r.index}</td>
        <td style="border: 1px solid #000; text-align: left; padding: 2px 5px; font-size: 8.5pt;">${r.name}</td>
        <td style="border: 1px solid #000; text-align: center; padding: 2px 2px; font-size: 8.5pt;">${r.unit}</td>
        <td style="border: 1px solid #000; text-align: center; padding: 2px 2px; font-size: 8.5pt; font-weight: bold;">${r.qty}</td>
        <td style="border: 1px solid #000; text-align: center; padding: 2px 2px; font-size: 8.5pt; font-style: italic;">${r.qtyWords}</td>
      </tr>
    `,
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Talabnoma № ${data.seqNumber || 1}</title>
          <style>
            @page {
              size: A4 portrait;
              margin-top: 8mm;
              margin-bottom: 8mm;
              margin-left: 20mm;
              margin-right: 15mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 0;
              width: 175mm;
            }
            .page-container {
              width: 175mm;
              min-height: 281mm;
              position: relative;
              box-sizing: border-box;
              margin: 0;
            }
            .talabnoma-block {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              box-sizing: border-box;
              width: 100%;
              height: 133mm;
              padding: 2mm 0;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .full-cut-line {
              position: absolute;
              top: 140.5mm;
              left: 0;
              width: 100%;
              border-top: 1.5px dashed #000;
            }
          </style>
        </head>
        <body>
          <div class="page-container">
            <div class="talabnoma-block">
              <div>
                <div style="text-align: center; font-weight: normal; font-size: 10.5pt; margin-bottom: 6px; line-height: 1.2;">
                  ${orgName}
                </div>

                <div style="text-align: center; font-size: 13pt; font-weight: bold; letter-spacing: 2px; margin-bottom: 4px;">
                  T A L A B N O M A &nbsp; № &nbsp;<u>&nbsp; ${data.seqNumber || 1} &nbsp;</u>
                </div>

                <div style="text-align: center; font-size: 10.5pt; margin-bottom: 10px;">
                  « <u>&nbsp; ${day} &nbsp;</u> » &nbsp;&nbsp; <u>&nbsp;&nbsp;&nbsp; ${monthName} &nbsp;&nbsp;&nbsp;</u> &nbsp;&nbsp; ${year} -yil
                </div>

                <div style="font-size: 10pt; margin-bottom: 8px; line-height: 1.4;">
                  <div style="margin-bottom: 4px;">
                    <span style="font-weight: bold; text-decoration: underline;">Kimdan:</span> &nbsp;&nbsp;
                    <span style="text-decoration: underline; font-weight: normal;">${fromName}</span>
                  </div>
                  <div>
                    <span style="font-weight: bold; text-decoration: underline;">Kimga:</span> &nbsp;&nbsp;
                    <span style="border-bottom: 1px solid #000; display: inline-block; width: 85%; text-indent: 6px; font-weight: normal;">${toName}</span>
                  </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; border: 1.2px solid #000; font-size: 9pt; margin-bottom: 8px;">
                  <thead>
                    <tr style="height: 20px;">
                      <th rowspan="2" style="border: 1px solid #000; width: 26px; text-align: center; padding: 2px; font-weight: bold;">№</th>
                      <th rowspan="2" style="border: 1px solid #000; text-align: center; padding: 2px; font-weight: bold;">Tovar nomi</th>
                      <th rowspan="2" style="border: 1px solid #000; width: 75px; text-align: center; padding: 2px; font-weight: bold;">O‘lchov<br/>birligi</th>
                      <th colspan="2" style="border: 1px solid #000; text-align: center; padding: 2px; font-weight: bold;">Chiqarilgan soni</th>
                    </tr>
                    <tr style="height: 18px;">
                      <th style="border: 1px solid #000; width: 60px; text-align: center; padding: 2px; font-weight: bold;">soni</th>
                      <th style="border: 1px solid #000; width: 125px; text-align: center; padding: 2px; font-weight: bold;">so‘zda</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRowsHtml}
                  </tbody>
                </table>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 10pt; padding-top: 6px;">
                <div style="width: 46%; text-align: left;">
                  <div style="display: flex; align-items: flex-end;">
                    <span style="font-weight: bold; margin-right: 6px;">Topshirdi</span>
                    <div style="border-bottom: 1px solid #000; width: 110px; min-height: 22px;"></div>
                  </div>
                  <div style="font-size: 7.5pt; text-align: center; margin-top: 2px; width: 175px;">(F.I.SH, imzo)</div>
                </div>

                <div style="width: 46%; text-align: left;">
                  <div style="display: flex; align-items: flex-end;">
                    <span style="font-weight: bold; margin-right: 6px;">Qabul qildi</span>
                    <div style="border-bottom: 1px solid #000; width: 110px; min-height: 22px;"></div>
                  </div>
                  <div style="font-size: 7.5pt; text-align: center; margin-top: 2px; width: 185px;">(F.I.SH, imzo)</div>
                </div>
              </div>

            </div>

            <div class="full-cut-line"></div>
          </div>
        </body>
      </html>
    `;

    return this.renderHtmlToPdf(htmlContent);
  }

  async generatePdfAct(id: string): Promise<Buffer> {
    const operation = await this.prisma.operation.findUnique({
      where: { id },
      include: {
        product: true,
        asset: true,
        user: { include: { department: true, organization: true } },
        department: true,
        performedBy: true,
        organization: true,
      },
    });

    if (!operation) {
      throw new NotFoundException(t('errors.OPERATION_NOT_FOUND', {}, 'Operatsiya topilmadi'));
    }

    const orgName =
      operation.organization?.name ||
      operation.user?.organization?.name ||
      'O‘zbekiston Respublikasi Qurilish va uy-joy kommunal xo‘jaligi vazirligi';

    const relatedOperations = operation.documentNumber
      ? await this.prisma.operation.findMany({
          where: {
            documentNumber: operation.documentNumber,
            type: operation.type,
          },
          include: {
            product: true,
            asset: true,
            user: { include: { department: true } },
            department: true,
            performedBy: true,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [operation];

    const isAsosiyVosita = operation.product?.productType === ProductType.BERILADIGAN;

    if (isAsosiyVosita && (operation.type === 'GIVE_TO_USER' || operation.type === 'ASSIGN_TO_DEPT')) {
      const targetUser = operation.user;
      const targetName = targetUser
        ? targetUser.fullName
        : operation.department
        ? operation.department.name
        : 'Xodim';

      const items = relatedOperations.map((op) => ({
        name: op.product?.name || 'Mahsulot',
        inventoryNumber: op.asset?.inventoryNumber || '',
        serialNumber: op.asset?.serialNumber || '',
      }));

      return this.generateModdiyJavobgarlikPdf({
        documentNumber: operation.documentNumber || `MJSH-${operation.id.slice(-6)}`,
        date: operation.createdAt,
        toRecipient: targetName,
        recipientPassport: targetUser?.passport || '',
        recipientAddress: targetUser?.address || '',
        orgName,
        items,
      });
    }

    if (!isAsosiyVosita && (operation.type === 'GIVE_TO_USER' || operation.type === 'GIVE_TO_DEPT')) {
      const targetUser = operation.user;
      const targetName = targetUser
        ? `${targetUser.fullName}${targetUser.department?.name ? ` (${targetUser.department.name})` : ''}`
        : operation.department
        ? operation.department.name
        : 'Xodim';

      const items = relatedOperations.map((op) => ({
        name: op.product?.name || 'Material',
        unit: op.product?.unit || 'ta',
        quantity: op.quantity,
      }));

      return this.generateTalabnomaPdf({
        seqNumber: operation.documentNumber || operation.id.slice(-6),
        date: operation.createdAt,
        fromUser: operation.performedBy?.fullName || "Xo‘jalik mudiri",
        toRecipient: targetName,
        orgName,
        items,
      });
    }

    const lang = I18nContext.current()?.lang || 'uz';
    const dateStr = operation.createdAt.toLocaleDateString(
      lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      },
    );

    const tableRows = relatedOperations.map((op, idx) => {
      const unitVal = op.product?.unit;
      const unitText = unitVal ? (t(`common.units.${unitVal}`) || unitVal) : t('pdf.unit_ta', {}, 'ta');
      return `
        <tr>
          <td class="center" style="text-align: center;">${idx + 1}</td>
          <td>${op.product?.name || t('pdf.unknown_product', {}, 'Noma‘lum mahsulot')}</td>
          <td>${op.asset?.inventoryNumber || '—'}</td>
          <td>${op.asset?.serialNumber || '—'}</td>
          <td class="center" style="text-align: center;">${op.quantity} ${unitText}</td>
        </tr>
      `;
    }).join('');

    let actTitle = t('pdf.title_give_user', {}, 'QABUL QILISH - TOPSHIRISH DALOLATNOMASI');
    let giverTitle = t('pdf.role_giver_give', {}, 'Topshirdi (Mas’ul shaxs)');
    let receiverTitle = t('pdf.role_receiver_give', {}, 'Qabul qildi');

    let giverName = operation.performedBy?.fullName || t('pdf.giver_default_name', {}, 'Ombor mudiri');
    let receiverName = '';
    let departmentName = '';

    if (operation.type === 'GIVE_TO_USER' || operation.type === 'TRANSFER_USER') {
      receiverName = operation.user?.fullName || '';
      departmentName = operation.user?.department?.name || '';
    } else if (operation.type === 'RETURN_FROM_USER') {
      actTitle = t('pdf.title_return_user', {}, 'JIHOZNI OMBORGA QAYTARISH DALOLATNOMASI');
      giverTitle = t('pdf.role_giver_return', {}, 'Topshirdi (Xodim)');
      receiverTitle = t('pdf.role_receiver_return', {}, 'Qabul qildi (Ombor mudiri)');
      giverName = operation.user?.fullName || '';
      receiverName = operation.performedBy?.fullName || t('pdf.giver_default_name', {}, 'Ombor mudiri');
      departmentName = operation.user?.department?.name || '';
    } else if (operation.type === 'ASSIGN_TO_DEPT' || operation.type === 'GIVE_TO_DEPT') {
      receiverName = t('pdf.receiver_default_name', {}, 'Bo‘lim mas’ul vakili');
      departmentName = operation.department?.name || '';
    } else if (operation.type === 'RETURN_FROM_DEPT') {
      actTitle = t('pdf.title_return_dept', {}, 'BO‘LIMDAN OMBORGA QAYTARISH DALOLATNOMASI');
      giverTitle = t('pdf.role_giver_dept_return', {}, 'Topshirdi (Bo‘lim)');
      receiverTitle = t('pdf.role_receiver_dept_return', {}, 'Qabul qildi (Ombor mudiri)');
      giverName = operation.department?.name || '';
      receiverName = operation.performedBy?.fullName || t('pdf.giver_default_name', {}, 'Ombor mudiri');
    } else if (operation.type === 'WRITE_OFF') {
      actTitle = t('pdf.title_write_off', {}, 'JIHOZ / MATERIALNI HISOBDAN CHIQARISH DALOLATNOMASI');
      giverTitle = t('pdf.role_giver_write_off', {}, 'Tasdiqladi (Admin)');
      receiverTitle = t('pdf.role_receiver_write_off', {}, 'Hisobdan chiqarildi (Utilizatsiya)');
      giverName = operation.performedBy?.fullName || t('pdf.admin_default_name', {}, 'Tizim Administratori');
      receiverName = t('pdf.write_off_location', {}, 'Ombor hisobidan o‘chirildi');
    }

    const docNum = operation.documentNumber || `DAL-${operation.id.slice(0, 8).toUpperCase()}`;
    const deptText = departmentName ? `(${t('pdf.dept_label', {}, 'Bo\'lim')}: ${departmentName})` : '';

    const descriptionText = t('pdf.description_give', {
      giverName,
      receiverName,
      deptText,
    }, `Ushbu dalolatnoma bir tomondan topshiruvchi <strong>${giverName}</strong>, ikkinchi tomondan qabul qiluvchi <strong>${receiverName}</strong> ${deptText} o'rtasida tuzildi. Mazkur hujjat orqali quyidagi tovar-moddiy boyliklar (TMB) rasmiylashtirildi:`);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            margin: 40px;
            font-size: 14px;
            color: #000;
            line-height: 1.5;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .doc-meta {
            width: 100%;
            margin-bottom: 20px;
            border-bottom: 1px solid #000;
            padding-bottom: 10px;
          }
          .doc-meta td {
            font-size: 14px;
          }
          .text-right {
            text-align: right;
          }
          .content-text {
            text-indent: 50px;
            text-align: justify;
            margin-bottom: 25px;
          }
          .table-title {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 15px;
          }
          table.items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }
          table.items th, table.items td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
          }
          table.items th {
            background-color: #f2f2f2;
            font-weight: bold;
            text-align: center;
          }
          table.items td.center {
            text-align: center;
          }
          .signatures {
            width: 100%;
            margin-top: 50px;
          }
          .signatures td {
            width: 50%;
            vertical-align: top;
          }
          .sig-line {
            margin-top: 40px;
            border-top: 1px solid #000;
            width: 80%;
            text-align: center;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${t('pdf.system_title', {}, 'TASHKILOT OMBOR TIZIMI (WMS)')}</h2>
          <h2 style="margin-top: 5px;">${actTitle}</h2>
        </div>

        <table class="doc-meta">
          <tr>
            <td><strong>${t('pdf.doc_number', {}, 'Hujjat №')}:</strong> ${docNum}</td>
            <td class="text-right"><strong>${t('pdf.date', {}, 'Sana')}:</strong> ${dateStr}</td>
          </tr>
        </table>

        <div class="content-text">
          ${descriptionText}
        </div>

        <div class="table-title">${t('pdf.table_title', {}, 'Topshirilgan Tovar-Moddiy Boyliklar ro\'yxati:')}</div>
        <table class="items">
          <thead>
            <tr>
              <th style="width: 5%;">${t('pdf.col_no', {}, '№')}</th>
              <th style="width: 45%;">${t('pdf.col_name', {}, 'Mahsulot nomi')}</th>
              <th style="width: 20%;">${t('pdf.col_inv', {}, 'Inventar raqami')}</th>
              <th style="width: 15%;">${t('pdf.col_serial', {}, 'Seriya raqami')}</th>
              <th style="width: 15%;">${t('pdf.col_qty', {}, 'Soni (O\'lchov)')}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="content-text" style="margin-top: 20px;">
          ${t('pdf.footer_text', {}, 'Topshirilgan tovar-moddiy boyliklar to‘liq holatda, soz, butun va talabga javob beradigan darajada topshirildi. Tomonlarning bir-biriga nisbatan e‘tirozlari mavjud emas.')}
        </div>

        <table class="signatures">
          <tr>
            <td>
              <strong>${giverTitle}:</strong>
              <div class="sig-line">
                (${t('pdf.signature_label', {}, 'imzo, sana')})<br><br>
                <strong>${giverName}</strong>
              </div>
            </td>
            <td>
              <strong>${receiverTitle}:</strong>
              <div class="sig-line">
                (${t('pdf.signature_label', {}, 'imzo, sana')})<br><br>
                <strong>${receiverName}</strong>
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.renderHtmlToPdf(htmlContent);
  }

}
