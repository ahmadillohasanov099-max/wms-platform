import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { ProductType } from '@prisma/client';
import { StockInDto } from '../dto/stock-in.dto';
import { WriteOffDto } from '../dto/write-off.dto';
import { BulkWriteOffDto } from '../dto/bulk-write-off.dto';
import { EventsGateway } from '../../events/events.gateway';
import { OperationsNotifierService } from './operations-notifier.service';

@Injectable()
export class OperationsStockService {
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

    const result = await this.prisma.$transaction(async (tx) => {
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
            minLevel: dto.minLevel || 5,
          },
        });
      }

      await tx.inventory.update({
        where: { productId: product.id },
        data: {
          quantity: { increment: dto.quantity },
        },
      });

      if (dto.productType === ProductType.BERILADIGAN && dto.inventoryNumbers) {
        for (let i = 0; i < dto.quantity; i++) {
          const invNum = dto.inventoryNumbers[i];
          const serialNum = dto.serialNumbers?.[i] || null;

          await tx.asset.create({
            data: {
              productId: product.id,
              inventoryNumber: invNum,
              serialNumber: serialNum,
              status: 'ACTIVE',
              organizationId: performerOrgId,
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
          note: dto.note,
          organizationId: performerOrgId,
        },
      });

      return tx.product.findUnique({
        where: { id: product.id },
        include: { inventory: true },
      });
    });

    if (result?.id) {
      this.eventsGateway.broadcastInventoryUpdated({ productId: result.id });
    }
    return result;
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

        this.notifierService.notifyTelegramForOperation(op.id, dto.documentNumber);

        return { message: 'Jihoz hisobdan chiqarildi', op };
      });

      void this.notifierService.checkStockAndAlert(asset.productId);
      this.eventsGateway.broadcastInventoryUpdated({ productId: asset.productId });
      this.eventsGateway.broadcastAssignmentUpdated({ type: 'WRITE_OFF', assetId: dto.assetId });
      this.eventsGateway.broadcastOperationCreated(result.op);
      return { message: result.message };
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

        const op = await tx.operation.create({
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

        return { message: "Material bo'limdan muvaffaqiyatli hisobdan chiqarildi", op };
      });

      this.eventsGateway.broadcastInventoryUpdated({ productId: dto.productId });
      this.eventsGateway.broadcastAssignmentUpdated({ type: 'WRITE_OFF', departmentId: dto.departmentId });
      this.eventsGateway.broadcastOperationCreated(result.op);
      return { message: result.message };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const invUpdate = await tx.inventory.updateMany({
        where: { productId: dto.productId, quantity: { gte: dto.quantity! } },
        data: { quantity: { decrement: dto.quantity! } },
      });
      if (invUpdate.count === 0) {
        throw new BadRequestException("Omborda yetarli miqdor yo'q");
      }

      const op = await tx.operation.create({
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

      return { message: 'Mahsulot hisobdan chiqarildi', op };
    });

    void this.notifierService.checkStockAndAlert(dto.productId!);
    this.eventsGateway.broadcastInventoryUpdated({ productId: dto.productId });
    this.eventsGateway.broadcastAssignmentUpdated({ type: 'WRITE_OFF' });
    this.eventsGateway.broadcastOperationCreated(result.op);
    return { message: result.message };
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
            throw new BadRequestException(`"${product.name}" asosiy vositasi uchun inventar raqami (jihoz) ko‘rsatilishi shart!`);
          }
        } else {
          if (!item.quantity || item.quantity <= 0) {
            throw new BadRequestException(`"${product.name}" sarflanadigan materiali uchun miqdor kiritilishi shart!`);
          }

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
              organizationId: performerOrgId || product.organizationId,
            },
          });
        }
      }

      return { message: 'Belgilangan mahsulotlar muvaffaqiyatli hisobdan chiqarildi', documentNumber: docNum };
    });

    for (const item of dto.items) {
      void this.notifierService.checkStockAndAlert(item.productId);
      this.eventsGateway.broadcastInventoryUpdated({ productId: item.productId });
    }
    this.eventsGateway.broadcastAssignmentUpdated({ type: 'WRITE_OFF' });

    return result;
  }
}
