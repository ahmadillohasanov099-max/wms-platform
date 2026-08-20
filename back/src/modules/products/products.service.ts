import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from 'src/prisma';
import { AuditService } from 'src/common/services/audit.service';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { t } from 'src/common';
import { ActiveUser } from 'src/common/interfaces';
import { enforceTenantOrgId } from 'src/common/helper/tenant.helper';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(query: ProductQueryDto, currentUser?: ActiveUser) {
    const { page = 1, limit = 20, search, productType, organizationId } = query as any;
    const skip = (page - 1) * limit;

    const targetOrgId = enforceTenantOrgId(currentUser, organizationId);

    const where: any = {
      deletedAt: null,
      ...(targetOrgId && { organizationId: targetOrgId }),
      ...(productType && { productType }),
      ...(search && {
        name: { contains: search, mode: 'insensitive' },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          inventory: {
            select: { quantity: true, minLevel: true, unitPrice: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
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
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        inventory: {
          select: {
            quantity: true,
            minLevel: true,
            unitPrice: true,
            totalValue: true,
          },
        },
        assets: {
          where: { deletedAt: null },
          include: {
            assignments: {
              where: { returnedAt: null },
              include: {
                user: { select: { id: true, fullName: true } },
                department: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { assets: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(t('errors.PRODUCT_NOT_FOUND', {}, 'Mahsulot topilmadi'));
    }

    if (product.productType === 'BERILADIGAN' && product.inventory && product.assets) {
      const freeAssetsCount = product.assets.filter(
        (a) => a.status === 'ACTIVE' && (!a.assignments || a.assignments.length === 0)
      ).length;

      if (product.inventory.quantity !== freeAssetsCount) {
        await this.prisma.inventory.update({
          where: { productId: id },
          data: { quantity: freeAssetsCount },
        });
        product.inventory.quantity = freeAssetsCount;
      }
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto, updatedBy: string) {
    const updaterUser = await this.prisma.user.findUnique({
      where: { id: updatedBy },
      select: { id: true, role: true, organizationId: true },
    });

    const isSuperOrMinistry =
      updaterUser?.role === 'SUPER_ADMIN' ||
      updaterUser?.role === 'VAZIRLIK_OMBORCHI';

    const oldProduct = await this.findOne(id);

    if (!isSuperOrMinistry && updaterUser?.organizationId) {
      if (oldProduct.organizationId && oldProduct.organizationId !== updaterUser.organizationId) {
        throw new BadRequestException("Siz boshqa tashkilot mahsulotini tahrirlay olmaysiz");
      }
    }

    const { code, ...updateData } = dto as any;

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        inventory: {
          select: { quantity: true, minLevel: true, unitPrice: true },
        },
      },
    });

    await this.auditService.log({
      userId: updatedBy,
      action: AuditAction.UPDATE,
      tableName: 'Product',
      recordId: id,
      oldData: oldProduct,
      newData: updatedProduct,
    });

    return updatedProduct;
  }

  async remove(id: string, deletedBy: string) {
    const deleterUser = await this.prisma.user.findUnique({
      where: { id: deletedBy },
      select: { id: true, role: true, organizationId: true },
    });

    const isSuperOrMinistry =
      deleterUser?.role === 'SUPER_ADMIN' ||
      deleterUser?.role === 'VAZIRLIK_OMBORCHI';

    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) {
      throw new NotFoundException(t('errors.PRODUCT_NOT_FOUND', {}, 'Mahsulot topilmadi'));
    }

    if (!isSuperOrMinistry && deleterUser?.organizationId) {
      if (product.organizationId && product.organizationId !== deleterUser.organizationId) {
        throw new BadRequestException("Siz boshqa tashkilot mahsulotini o'chira olmaysiz");
      }
    }


    if (product.inventory && product.inventory.quantity > 0) {
      throw new BadRequestException(
        t('errors.PRODUCT_IN_STOCK', {}, "Mahsulot omborda mavjud, o'chirib bo'lmaydi"),
      );
    }

    const activeAssets = await this.prisma.asset.count({
      where: { productId: id, deletedAt: null },
    });
    if (activeAssets > 0) {
      throw new BadRequestException(
        t('errors.ACTIVE_ASSETS_EXIST', {}, "Mahsulotda aktiv jihozlar bor, o'chirib bo'lmaydi"),
      );
    }

    const activeDeptAssets = await this.prisma.departmentAsset.aggregate({
      where: { productId: id },
      _sum: { quantity: true },
    });
    if (activeDeptAssets._sum.quantity && activeDeptAssets._sum.quantity > 0) {
      throw new BadRequestException(
        t('errors.PRODUCT_IN_DEPTS', {}, "Ushbu mahsulot bo'limlarda mavjud, o'chirib bo'lmaydi"),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          userId: deletedBy,
          action: 'DELETE_PRODUCT',
          resource: 'Product',
          resourceId: id,
          method: 'DELETE',
          endpoint: `/products/${id}`,
          oldData: product as any,
        },
      });

      return { message: "Mahsulot muvaffaqiyatli o'chirildi" };
    });
  }

  async getHistory(id: string, page = 1, limit = 20) {
    await this.findOne(id);

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.operation.findMany({
        where: { productId: id },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, fullName: true, username: true } },
          fromUser: { select: { id: true, fullName: true, username: true } },
          asset: { select: { id: true, inventoryNumber: true } },
          department: { select: { id: true, name: true } },
          performedBy: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.operation.count({ where: { productId: id } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
}
