import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { SetMinLevelDto } from './dto/set-min-level.dto';
import { BulkStockInDto } from './dto';
import { ProductType } from '@prisma/client';
import { enforceTenantOrgId } from 'src/common/helper/tenant.helper';
import { InventoryExcelService, ExportInventoryOptions } from './services/inventory-excel.service';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private excelService: InventoryExcelService,
  ) {}

  async findAll(targetOrgId?: string, currentUser?: any, search?: string) {
    const resolvedOrgId = enforceTenantOrgId(currentUser, targetOrgId);
    const orgFilter: any = resolvedOrgId ? { organizationId: resolvedOrgId } : {};
    const trimmedSearch = search?.trim();

    const items = await this.prisma.inventory.findMany({
      where: {
        product: {
          deletedAt: null,
          ...orgFilter,
          ...(trimmedSearch && {
            OR: [
              { name: { contains: trimmedSearch, mode: 'insensitive' } },
              { description: { contains: trimmedSearch, mode: 'insensitive' } },
              {
                assets: {
                  some: {
                    deletedAt: null,
                    OR: [
                      { inventoryNumber: { contains: trimmedSearch, mode: 'insensitive' } },
                      { serialNumber: { contains: trimmedSearch, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }),
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            productType: true,
            unit: true,
            imageUrl: true,
            year: true,
            ...(trimmedSearch && {
              assets: {
                where: {
                  deletedAt: null,
                  OR: [
                    { inventoryNumber: { contains: trimmedSearch, mode: 'insensitive' } },
                    { serialNumber: { contains: trimmedSearch, mode: 'insensitive' } },
                  ],
                },
                select: {
                  inventoryNumber: true,
                  serialNumber: true,
                },
              },
            }),
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return items.map((item) => {
      const realQty = item.quantity;
      return {
        ...item,
        quantity: realQty,
        totalValue: realQty * Number(item.unitPrice ?? 0),
        isLowStock: realQty <= item.minLevel,
      };
    });
  }

  async findOne(productId: string) {
    const inventory = await this.prisma.inventory.findFirst({
      where: {
        productId,
        product: {
          deletedAt: null,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            productType: true,
            unit: true,
            imageUrl: true,
            assets: {
              where: {
                deletedAt: null,
                status: 'ACTIVE',
                assignments: { none: { returnedAt: null } },
              },
              select: {
                id: true,
                inventoryNumber: true,
                serialNumber: true,
              },
            },
          },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Mahsulot ombori topilmadi');
    }

    return {
      ...inventory,
      totalValue: inventory.quantity * Number(inventory.unitPrice ?? 0),
      isLowStock: inventory.quantity < inventory.minLevel,
    };
  }

  async getAssignedAssets(targetOrgId?: string, currentUser?: any) {
    const resolvedOrgId = enforceTenantOrgId(currentUser, targetOrgId);
    const orgFilter: any = resolvedOrgId ? { organizationId: resolvedOrgId } : {};

    const assignments = await this.prisma.assignment.findMany({
      where: {
        returnedAt: null,
        asset: {
          deletedAt: null,
          product: { deletedAt: null, ...orgFilter },
        },
      },
      take: 250,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            department: { select: { id: true, name: true } },
          },
        },
        department: { select: { id: true, name: true } },
        asset: {
          select: {
            id: true,
            inventoryNumber: true,
            serialNumber: true,
            purchasePrice: true,
            createdAt: true,
            status: true,
            product: {
              select: {
                id: true,
                name: true,
                productType: true,
                unit: true,
              },
            },
            operations: {
              where: {
                type: { in: ['GIVE_TO_USER', 'GIVE_TO_DEPT', 'ASSIGN_TO_DEPT', 'TRANSFER_USER'] },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                performedBy: { select: { id: true, fullName: true, username: true } },
              },
            },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return assignments.map((asgn) => {
      const asset = asgn.asset;
      const latestOp = asset?.operations?.[0];
      const isUser = !!asgn.userId;

      return {
        id: asgn.id,
        assetId: asset?.id,
        productName: asset?.product?.name,
        productType: asset?.product?.productType,
        inventoryNumber: asset?.inventoryNumber,
        serialNumber: asset?.serialNumber,
        purchasePrice: Number(asset?.purchasePrice || 0),
        status: asgn.status,
        assetStatus: asset?.status,
        assignmentStatus: asgn.status,
        holderType: isUser ? 'USER' : 'DEPARTMENT',
        holderName: isUser ? asgn.user?.fullName : asgn.department?.name,
        departmentName: asgn.department?.name || asgn.user?.department?.name || '—',
        departmentId: asgn.departmentId || asgn.user?.department?.id,
        assignedAt: asgn.assignedAt,
        performedBy: latestOp?.performedBy?.fullName || '—',
        documentNumber: latestOp?.documentNumber || '—',
        holderUser: asgn.user,
        isPendingAcceptance: asgn.status === 'PENDING',
        rejectedAt: asgn.rejectedAt,
        rejectionReason: asgn.rejectionReason,
      };
    });
  }

  async getInRepairAssets(targetOrgId?: string, currentUser?: any) {
    const resolvedOrgId = enforceTenantOrgId(currentUser, targetOrgId);
    const orgFilter: any = resolvedOrgId ? { organizationId: resolvedOrgId } : {};

    const assets = await this.prisma.asset.findMany({
      where: {
        status: 'BROKEN',
        deletedAt: null,
        product: { deletedAt: null, ...orgFilter },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            productType: true,
            unit: true,
            imageUrl: true,
          },
        },
        assignments: {
          where: { returnedAt: null },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true,
                department: { select: { id: true, name: true } },
              },
            },
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return assets.map((asset) => {
      const activeAssignment = asset.assignments?.[0];
      const holderUser = activeAssignment?.user;
      const holderDept = activeAssignment?.department || holderUser?.department;

      return {
        id: asset.id,
        inventoryNumber: asset.inventoryNumber,
        serialNumber: asset.serialNumber,
        status: asset.status,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
        purchasePrice: asset.purchasePrice,
        product: asset.product,
        holderName: holderUser?.fullName || holderDept?.name || 'Ombor zaxirasida',
        holderDepartment: holderDept?.name || '—',
        holderUser,
        assignments: asset.assignments,
      };
    });
  }

  async getLowStock(organizationId?: string): Promise<any[]> {
    if (organizationId) {
      return this.prisma.$queryRaw`
        SELECT
          i."productId",
          p.name,
          p."productType",
          p.unit,
          i.quantity,
          i."minLevel",
          (i."minLevel" - i.quantity) AS shortage
        FROM "Inventory" i
        JOIN "Product" p ON p.id = i."productId"
        WHERE i.quantity < i."minLevel"
          AND p."deletedAt" IS NULL
          AND p."organizationId" = ${organizationId}
        ORDER BY shortage DESC
      `;
    }

    return this.prisma.$queryRaw`
      SELECT
        i."productId",
        p.name,
        p."productType",
        p.unit,
        i.quantity,
        i."minLevel",
        (i."minLevel" - i.quantity) AS shortage
      FROM "Inventory" i
      JOIN "Product" p ON p.id = i."productId"
      WHERE i.quantity < i."minLevel"
        AND p."deletedAt" IS NULL
      ORDER BY shortage DESC
    `;
  }

  async setMinLevel(dto: SetMinLevelDto) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId: dto.productId },
    });

    if (!inventory) {
      throw new NotFoundException('Mahsulot ombori topilmadi');
    }

    return this.prisma.inventory.update({
      where: { productId: dto.productId },
      data: { minLevel: dto.minLevel },
      include: {
        product: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async bulkStockIn(dto: BulkStockInDto, performedById: string) {
    const performerUser = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { organizationId: true },
    });
    const performerOrgId = performerUser?.organizationId || null;

    const results: any[] = [];

    // 1. Ommaviy validatsiya
    const allInventoryNumbers: string[] = [];
    for (const item of dto.items) {
      if (item.productType === ProductType.BERILADIGAN) {
        if (
          !item.inventoryNumbers ||
          item.inventoryNumbers.length !== item.quantity
        ) {
          throw new BadRequestException(
            `"${item.name}" jihozi uchun aynan ${item.quantity} ta inventar raqam yuborilishi shart!`,
          );
        }
        allInventoryNumbers.push(...item.inventoryNumbers);
      }
    }

    if (allInventoryNumbers.length > 0) {
      const uniqueNumbers = new Set(allInventoryNumbers);
      if (uniqueNumbers.size !== allInventoryNumbers.length) {
        throw new BadRequestException(
          'Ommaviy yuklanayotgan inventar raqamlari ichida takrorlanishlar mavjud!',
        );
      }

      const existingAsset = await this.prisma.asset.findFirst({
        where: {
          inventoryNumber: { in: allInventoryNumbers },
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

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        let product = await tx.product.findFirst({
          where: {
            name: item.name,
            productType: item.productType,
            organizationId: performerOrgId,
            deletedAt: null,
          },
          include: { inventory: true },
        });

        if (!product) {
          product = await tx.product.create({
            data: {
              name: item.name,
              productType: item.productType,
              unit: item.unit ?? 'DONA',
              year: item.year ?? null,
              description: item.description,
              organizationId: performerOrgId,
            },
            include: { inventory: true },
          });

          await tx.inventory.create({
            data: {
              productId: product.id,
              quantity: 0,
              minLevel: 0,
            },
          });

          product = await tx.product.findUnique({
            where: { id: product.id },
            include: { inventory: true },
          });
        }

        const updatedInventory = await tx.inventory.update({
          where: { productId: product!.id },
          data: {
            quantity: { increment: item.quantity },
            unitPrice: item.unitPrice,
            totalValue: { increment: item.quantity * item.unitPrice },
          },
        });

        // 2. Jihozlarni (Asset) avtomatik yaratish
        if (
          item.productType === ProductType.BERILADIGAN &&
          item.inventoryNumbers
        ) {
          for (let i = 0; i < item.inventoryNumbers.length; i++) {
            await tx.asset.create({
              data: {
                productId: product!.id,
                inventoryNumber: item.inventoryNumbers[i],
                serialNumber: item.serialNumbers?.[i] || null,
                organizationId: performerOrgId,
                status: 'ACTIVE',
                purchasePrice: item.unitPrice || null,
              },
            });
          }
        }

        await tx.operation.create({
          data: {
            type: 'STOCK_IN',
            quantity: item.quantity,
            productId: product!.id,
            performedById,
            documentNumber: item.documentNumber,
            note: item.note,
            organizationId: performerOrgId,
          },
        });

        results.push({
          productId: product!.id,
          name: product!.name,
          productType: product!.productType,
          quantity: updatedInventory.quantity,
          unitPrice: item.unitPrice,
          totalValue: updatedInventory.quantity * item.unitPrice,
        });
      }
    });

    return {
      message: `${dto.items.length} ta mahsulot muvaffaqiyatli kirim qilindi`,
      count: dto.items.length,
      results,
    };
  }

  async exportExcel(
    optionsOrOrgId?: string | ExportInventoryOptions,
    productType?: ProductType | string,
  ): Promise<{ buffer: Buffer; organizationName: string; resolvedType?: ProductType }> {
    return this.excelService.exportExcel(optionsOrOrgId, productType);
  }

  async importExcel(fileBuffer: Buffer, performedById: string, requestedProductType?: string) {
    return this.excelService.importExcel(fileBuffer, performedById, requestedProductType);
  }

  async importMasterExcel(fileBuffer: Buffer, performedById: string) {
    return this.excelService.importMasterExcel(fileBuffer, performedById);
  }

  async downloadTemplate(productType?: string): Promise<Buffer> {
    return this.excelService.downloadTemplate(productType);
  }

  async downloadMasterTemplate(): Promise<Buffer> {
    return this.excelService.downloadMasterTemplate();
  }

  async generateMasterTemplate(): Promise<Buffer> {
    return this.excelService.downloadMasterTemplate();
  }
}